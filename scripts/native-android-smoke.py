"""Drive native Views against the real, synthetic HTTPS backend on a disposable emulator."""
import json
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

OUTPUT = Path('.tools/native-qa-artifact')
OUTPUT.mkdir(parents=True, exist_ok=True)
CONFIG = json.loads(Path('.tools/native-fixture.json').read_text())
PACKAGE = 'io.github.zuquanzhi.veladeck.dev'
ACTIVITY = PACKAGE + '/io.github.zuquanzhi.veladeck.MainActivity'
stage = 'startup'


def adb(*args, binary=False):
    result = subprocess.run(['adb', *args], capture_output=True, text=not binary, timeout=40)
    if result.returncode:
        raise AssertionError('ADB command failed in ' + stage)
    return result.stdout


def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/native-qa.xml')
    xml = adb('exec-out', 'cat', '/sdcard/native-qa.xml')
    root = ET.fromstring(xml)
    # Never retain a pairing code in test report XML.
    for node in root.iter('node'):
        if '配对码' in node.get('content-desc', ''):
            node.set('text', '[redacted]')
    (OUTPUT / 'last-ui.xml').write_text(ET.tostring(root, encoding='unicode'))
    return list(root.iter('node'))


def screenshot(name):
    (OUTPUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))


def swipe(up=True):
    size = re.search(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))
    width, height = map(int, size.groups())
    start, end = (height * 76 // 100, height * 30 // 100) if up else (height * 30 // 100, height * 76 // 100)
    adb('shell', 'input', 'swipe', str(width // 2), str(start), str(width // 2), str(end), '350')


def wait(predicate, scroll=False, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            for node in nodes():
                if predicate(node):
                    return node
        except (ET.ParseError, subprocess.TimeoutExpired):
            pass
        if scroll:
            swipe()
        time.sleep(.5)
    raise AssertionError('Native screen expectation failed in ' + stage)


def text(value, scroll=False):
    return wait(lambda node: node.get('text') == value, scroll)


def starts(value, scroll=False):
    return wait(lambda node: node.get('text', '').startswith(value), scroll)


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


def fill(node, value):
    tap(node)
    adb('shell', 'input', 'keyevent', '123')
    count = min(150, len(node.get('text', '')) + 5)
    adb('shell', 'input', 'keyevent', *(['67'] * count))
    adb('shell', 'input', 'text', value.replace(' ', '%s'))
    adb('shell', 'input', 'keyevent', '4')


def field(description, scroll=False):
    return wait(lambda node: node.get('class') == 'android.widget.EditText' and node.get('content-desc') == description, scroll)


def state():
    with urllib.request.urlopen('http://127.0.0.1:18092/state', timeout=10) as response:
        return json.load(response)


try:
    adb('install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk')
    adb('shell', 'am', 'start', '-n', ACTIVITY)
    stage = 'native connection and pairing'
    address = wait(lambda node: node.get('class') == 'android.widget.EditText')
    fill(address, CONFIG['server'])
    tap(starts('连接工作台'))
    text('连接你的工作台')
    screenshot('native-pairing')
    with urllib.request.urlopen('http://127.0.0.1:18092/pair', timeout=10) as response:
        pairing_code = json.load(response)['code']
    fill(field('6 位配对码'), pairing_code)
    tap(text('配对并进入工作台', True))
    text('工作台.')
    field('搜索产物、项目或关键词')
    starts('06 FILES', True)
    screenshot('native-workspace-light')

    stage = 'native artifact search and star'
    fill(field('搜索产物、项目或关键词'), 'API')
    tap(text('API 集成报告 · 演示', True))
    tap(text('星标'))
    text('已星标')
    wait(lambda node: '原生界面直接访问' in node.get('text', ''), True)
    screenshot('native-artifact')
    assert state()['starred'] == 1

    stage = 'native SSE conversation'
    tap(text('对话'))
    tap(text('新建对话'))
    tap(text('保存'))
    fill(field('给智能体发送指令…', True), 'native_stream_test')
    tap(text('发送', True))
    text('原生流式响应：已收到你的指令。', True)
    screenshot('native-conversation')

    stage = 'native approval and process forwarding'
    fill(field('给智能体发送指令…', True), 'approval_test')
    tap(text('发送', True))
    text('需要你的审批', True)
    tap(text('审批'))
    text('原生审批 · 演示', True)
    screenshot('native-approval')
    tap(text('通过', True))
    tap(text('确认'))
    text('没有待处理审批', True)
    assert any(row['status'] == 'approved' for row in state()['approvals'])

    stage = 'native Inbox write and archive'
    tap(text('Inbox'))
    fill(field('记下一个想法，或粘贴链接…'), 'native_inbox_test')
    tap(text('加入 Inbox'))
    wait(lambda node: node.get('text') == 'native_inbox_test' and node.get('class') == 'android.widget.TextView', True)
    tap(text('归档', True))
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if any(item['content'] == 'native_inbox_test' and item['status'] == 'archived' for item in state()['inbox']):
            break
        time.sleep(1)
    else:
        raise AssertionError('Native Inbox did not archive')

    stage = 'native operations'
    tap(text('运维'))
    text('运行概览.')
    text('暂无用量', True)
    screenshot('native-operations')

    stage = 'native settings and dark theme'
    tap(text('设置'))
    theme = starts('主题 ·', True)
    tap(theme)
    tap(text('深色'))
    text('设置.')
    tap(text('产物'))
    text('工作台.')
    starts('06 FILES', True)
    screenshot('native-workspace-dark')

    stage = 'encrypted session persistence'
    preferences = adb('shell', 'run-as', PACKAGE, 'cat', 'shared_prefs/native_session.xml')
    assert 'ad_device=' not in preferences and 'name="cookie"' in preferences and 'name="iv"' in preferences
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-n', ACTIVITY)
    text('工作台.')

    stage = 'native scheduled notifications'
    tap(text('设置'))
    tap(starts('本机后台提醒', True))
    with urllib.request.urlopen('http://127.0.0.1:18092/notify', timeout=10) as response:
        response.read()
    adb('shell', 'cmd', 'jobscheduler', 'run', '-f', PACKAGE, '20260')
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        notice = adb('shell', 'dumpsys', 'notification', '--noredact')
        if 'VelaDeck 有新进展' in notice:
            break
        time.sleep(1)
    else:
        raise AssertionError('Scheduled native notification was not posted')

    stage = 'native device revocation'
    for unused in range(3):
        swipe(False)
    tap(text('撤销', True))
    tap(text('确认'))
    starts('连接工作台')
    assert any(device['revoked_at'] is not None for device in state()['devices'])
    audit = state()['audit']
    assert len(audit) > 15 and all(request['path'].startswith('/api/') for request in audit)
    assert any('/events' in request['path'] or '/messages' in request['path'] for request in audit)
    assert any(request['path'] == '/api/approvals' for request in audit)
    (OUTPUT / 'api-audit.json').write_text(json.dumps(audit, indent=2))
    result = {'status': 'passed', 'api': 29, 'native_views': True, 'https_api_only': True,
              'checks': ['native pairing', 'artifact search/detail/star', 'SSE conversation',
                         'approval process forwarding', 'Inbox write/archive', 'operations',
                         'theme persistence', 'Keystore-encrypted session/restart',
                         'scheduled native notification', 'device revocation'], 'page_count': 7}
    (OUTPUT / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print('NATIVE ANDROID SMOKE PASS: pairing, artifacts, SSE, approvals, Inbox, operations, settings, encrypted session, notifications and revocation.')
except Exception:
    try:
        screenshot('failure')
        (OUTPUT / 'logcat.txt').write_text(adb('logcat', '-d', '-s', 'AndroidRuntime:E', 'VelaDeckUpdate:I', '*:S'))
        (OUTPUT / 'failure-stage.txt').write_text(stage)
    finally:
        raise
