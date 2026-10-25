"""Exercise the real public release update path on a disposable CI emulator.

The baseline is current source stamped with an older version and the fixed key.
It is a test fixture, not the historical temporary-signed 0.1.1 APK.
"""

import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path


OUTPUT = Path('.tools/android-update-smoke')
OUTPUT.mkdir(parents=True, exist_ok=True)
CONFIG = json.loads(Path('.tools/update-smoke-config.json').read_text())
PACKAGE = 'io.github.zuquanzhi.veladeck.preview'
ACTIVITY = PACKAGE + '/io.github.zuquanzhi.veladeck.MainActivity'


def adb(*args, binary=False):
    return subprocess.run(['adb', *args], check=True, capture_output=True,
                          text=not binary, timeout=40).stdout


def screen(name):
    (OUTPUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))


def hierarchy():
    adb('shell', 'uiautomator', 'dump', '/sdcard/veladeck-ui.xml')
    xml = adb('exec-out', 'cat', '/sdcard/veladeck-ui.xml')
    (OUTPUT / 'last-ui.xml').write_text(xml)
    return ET.fromstring(xml).iter('node')


def wait_node(predicate, timeout=100):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            for node in hierarchy():
                if predicate(node):
                    return node
        except (subprocess.SubprocessError, ET.ParseError):
            pass
        time.sleep(1)
    screen('failure')
    raise AssertionError('Expected update screen was not shown; inspect last-ui.xml')


def text(value):
    return wait_node(lambda n: n.get('text', '').casefold() == value.casefold())


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.attrib['bounds']))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


try:
    adb('install', '.tools/update-baseline.apk')
    adb('shell', 'am', 'start', '-n', ACTIVITY)
    offer = text('下载并安装')
    text('VelaDeck v' + CONFIG['target'])
    screen('01-update-available')
    tap(offer)
    permission = text('去设置')
    screen('02-download-verified')
    tap(permission)
    switch = wait_node(lambda n: n.get('resource-id', '').endswith(':id/switch_widget')
                       or n.get('class', '') == 'android.widget.Switch')
    if switch.get('checked') != 'true':
        tap(switch)
    wait_node(lambda n: (n.get('resource-id', '').endswith(':id/switch_widget')
                        or n.get('class', '') == 'android.widget.Switch') and n.get('checked') == 'true')
    screen('03-source-permission-enabled')
    adb('shell', 'input', 'keyevent', '4')
    install = text('Install')
    screen('04-system-install-confirmation')
    tap(install)
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        dump = adb('shell', 'dumpsys', 'package', PACKAGE)
        if re.search(r'\bversionCode=' + str(CONFIG['code']) + r'\b', dump):
            break
        time.sleep(2)
    else:
        raise AssertionError('The installed version did not advance')
    screen('05-upgrade-installed')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-n', ACTIVITY)
    wait_node(lambda n: n.get('text', '').startswith('v' + CONFIG['target'] + '-preview'))
    text('当前已是最新版本。')
    screen('06-updated-app')
    result = {'status': 'passed', 'api': 29, 'baseline_is_stamped_test_fixture': True,
              'baseline': CONFIG['baseline'], 'installed_version': CONFIG['target'],
              'installed_code': CONFIG['code'], 'checks': ['public GitHub release discovery',
                  'real APK download and verification', 'source permission UI',
                  'system install confirmation', 'in-place version upgrade', 'updated app launch']}
    (OUTPUT / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print('ANDROID UPDATE SMOKE PASS: release discovery → verified download → source permission → system confirmation → in-place upgrade.')
except Exception:
    try:
        screen('failure')
        (OUTPUT / 'logcat.txt').write_text(adb('logcat', '-d', '-t', '300'))
    finally:
        raise
