import { englishRequirements } from '../../data/mockData'
import { CertDetailText } from '../../utils/certDetail'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
  satisfied?: boolean
  detail?: string
  primaryRequirement?: string
}

export function EnglishCertModal({
  open,
  onClose,
  satisfied = false,
  detail,
  primaryRequirement,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={satisfied ? '영어졸업인증 이수 완료' : '영어졸업인증 최소 조건 안내'}
      subtitle={satisfied ? '인증 완료' : '기준 안내'}
    >
      {satisfied ? (
        <div className="rounded-xl bg-sejong/5 px-5 py-6 text-center">
          <p className="text-base font-bold text-sejong">영어졸업인증을 이수했습니다.</p>
          <CertDetailText
            detail={detail || primaryRequirement}
            className="mt-2 text-sm leading-relaxed text-ink-muted"
          />
        </div>
      ) : (
        <>
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
        </>
      )}
    </Modal>
  )
}
