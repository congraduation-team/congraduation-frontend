import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
}

export function SWCodingCertModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="SW코딩졸업인증" subtitle="비전공자">
      <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
        <span className="text-[15px] font-semibold text-ink">TOSC</span>
        <span className="text-[15px] font-semibold text-ink">Level 5 이상</span>
      </div>

      <p className="mb-2 mt-5 text-sm text-ink-muted">대체과목</p>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
          <span className="text-[15px] font-semibold text-ink">고급C프로그래밍및실습</span>
          <span className="text-[15px] font-semibold text-ink">B0이상</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
          <span className="text-[15px] font-semibold text-ink">K-MOOC:코딩과스토리텔링</span>
          <span className="text-[15px] font-semibold text-ink">P이상</span>
        </div>
      </div>
    </Modal>
  )
}
