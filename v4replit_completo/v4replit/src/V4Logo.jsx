import v4LogoSrc from './v4logo.svg'

export function V4LogoFull({ width = 160 }) {
  return (
    <img
      src={v4LogoSrc}
      alt="V4 Company"
      width={width}
      style={{ display: 'block', filter: 'brightness(0) invert(1)' }}
    />
  )
}

export function V4LogoIcon({ size = 32 }) {
  return (
    <img
      src={v4LogoSrc}
      alt="V4"
      width={size}
      height={size}
      style={{ display: 'block', filter: 'brightness(0) invert(1)', objectFit: 'contain' }}
    />
  )
}
