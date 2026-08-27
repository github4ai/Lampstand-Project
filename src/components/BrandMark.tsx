interface BrandMarkProps {
  size?: number
  monochrome?: boolean
}

export default function BrandMark({ size = 28, monochrome = false }: BrandMarkProps) {
  const gold = monochrome ? 'currentColor' : '#f3c969'
  const lightGold = monochrome ? 'currentColor' : '#fff0af'
  const blue = monochrome ? 'currentColor' : '#50c9ee'
  const lightBlue = monochrome ? 'currentColor' : '#b9ecff'
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M24 12v26M24 20c-5 0-8-3.5-8-8M24 26c-8.2 0-13-5.4-13-12M24 32C12.7 32 6 25.2 6 16M24 20c5 0 8-3.5 8-8M24 26c8.2 0 13-5.4 13-12M24 32c11.3 0 18-6.8 18-16" stroke={gold} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.8 14.2h4.4M8.8 12h4.4M13.8 10h4.4M21.8 9h4.4M29.8 10h4.4M34.8 12h4.4M39.8 14.2h4.4" stroke={lightGold} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 38h8l2.8 5H17.2L20 38Z" fill={blue} stroke={lightBlue} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M15 43h18" stroke={gold} strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  )
}
