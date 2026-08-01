import { Modal } from './Modal'
import { CertDetailText } from '../../utils/certDetail'

type Props = {
  open: boolean
  onClose: () => void
  satisfied?: boolean
  detail?: string
  primaryRequirement?: string
  substituteRequirement?: string
}

export function SWCodingCertModal({
  open,
  onClose,
  satisfied = false,
  detail,
  primaryRequirement,
  substituteRequirement,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={satisfied ? 'SW코딩졸업인증 이수 완료' : 'SW코딩졸업인증'}
      subtitle={satisfied ? '인증 완료' : '기준 안내'}
    >
      {satisfied ? (
        <div className="rounded-xl bg-sejong/5 px-5 py-6 text-center">
          <p className="text-base font-bold text-sejong">SW코딩졸업인증을 이수했습니다.</p>
          <CertDetailText detail={detail} className="mt-2 text-sm leading-relaxed text-ink-muted" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
            <span className="text-[15px] font-semibold text-ink">TOSC</span>
            <span className="text-[15px] font-semibold text-ink">
              {primaryRequirement || 'Level 5 이상'}
            </span>
          </div>

          <p className="mb-2 mt-5 text-sm text-ink-muted">대체과목</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
              <span className="text-[15px] font-semibold text-ink">고급C프로그래밍및실습</span>
              <span className="text-[15px] font-semibold text-ink">
                {substituteRequirement?.includes('고급C') ? substituteRequirement : 'B0이상'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
              <span className="text-[15px] font-semibold text-ink">K-MOOC:코딩과스토리텔링</span>
              <span className="text-[15px] font-semibold text-ink">P이상</span>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
