import appLogo from '../../assets/app-logo.png'

type AppLogoProps = {
  size?: number
  className?: string
}

export function AppLogo({ size = 88, className = '' }: AppLogoProps) {
  return (
    <img
      src={appLogo}
      alt="졸업 인증 분석 로고"
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] object-cover ${className}`}
      draggable={false}
    />
  )
}
