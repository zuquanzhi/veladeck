import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);dayjs.extend(timezone);
export const time=(value:number|string)=>dayjs(value).tz('Asia/Shanghai').format('MM-DD HH:mm');
