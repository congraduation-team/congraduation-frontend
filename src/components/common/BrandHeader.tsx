import { AppLogo } from '../common/AppLogo'

export function BrandHeader() {
  return (
    <header className="border-b border-[#eee] py-4">
      <div className="mx-auto flex max-w-md items-center justify-center gap-3 px-6">
        <AppLogo size={40} />
        <div className="text-left">
          <p className="text-lg font-bold leading-tight text-sejong">세종대학교</p>
          <p className="text-sm text-sejong">졸업 인증 분석</p>
        </div>
      </div>
    </header>
  )
}
