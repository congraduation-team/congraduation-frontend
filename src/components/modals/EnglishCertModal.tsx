import { englishRequirements } from '../../data/mockData'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
}

export function EnglishCertModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="영어졸업인증 최소 조건 안내" subtitle="비전공자">
      <div className="rounded-xl bg-panel px-5 py-4">
        <ul className="space-y-3.5">
          {englishRequirements.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-semibold text-ink">{item.label}</span>
              <span className="text-[15px] font-semibold text-ink">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-2 mt-5 text-sm text-ink-muted">대체과목</p>
      <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
        <span className="text-[15px] font-semibold text-ink">Intensive English</span>
        <span className="text-[15px] font-semibold text-ink">3학점</span>
      </div>
    </Modal>
  )
}
