/** Repairs line-break damage from the HWMR page scan so scanned readings read as the printed page does. */
export function repairHwmrReadingText(value = '') {
  return value
    .replace(/\b(vol\.)\s*\n+\s*(\d+)/gi, '$1 $2')
    .replace(/\b(chs?\.)\s*\n+\s*([\d—–-]+)/gi, '$1 $2')
    .replace(/([“"][^”"]{3,})\s*\n+\s*([^”"]{1,80}[”"])/g, '$1 $2')
    .replace(/([^\n])\s+(Further Reading\s*:)/gi, '$1\n\n$2 ')
    .replace(/\n{3,}/g, '\n\n')
}
