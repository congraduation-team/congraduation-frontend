import { CertDetailText } from '../../utils/certDetail'
import type { EnglishRequirementRow } from '../../utils/englishCertification'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
  satisfied?: boolean
  detail?: string
  primaryRequirement?: string
  policyType?: string
  status?: string
  requirements?: EnglishRequirementRow[]
}

export function EnglishCertModal({
  open,
  onClose,
  satisfied = false,
  detail,
  primaryRequirement,
  policyType,
  status,
  requirements = [],
}: Props) {
  const examRows = requirements.filter((r) => r.label !== '대체과목')
  const substitute = requirements.find((r) => r.label === '대체과목')
  const policyLabel =
    policyType === 'OPTIONAL' ? '선택(2023~)' : policyType === 'REQUIRED' ? '필수(~2022)' : policyType

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={satisfied ? '영어졸업인증 이수 완료' : '영어졸업인증 최소 조건 안내'}
      subtitle={
        satisfied
          ? status === 'EXEMPTED'
            ? '면제 · 인증 완료'
            : '인증 완료'
          : policyLabel
            ? `기준 안내 · ${policyLabel}`
            : '기준 안내'
      }
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
          {detail && (
            <div className="mb-4 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3">
              <CertDetailText detail={detail} className="text-sm leading-relaxed text-ink-muted" />
            </div>
          )}

          <div className="rounded-xl bg-panel px-5 py-4">
            <ul className="space-y-3.5">
              {examRows.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4">
                  <span className="text-[15px] font-semibold text-ink">{item.label}</span>
                  <span className="text-right text-[15px] font-semibold text-ink">
                    {item.value || '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {(substitute || /Intensive\s*English/i.test(primaryRequirement || '')) && (
            <>
              <p className="mb-2 mt-5 text-sm text-ink-muted">대체과목</p>
              <div className="flex items-center justify-between rounded-xl bg-panel px-5 py-4">
                <span className="text-[15px] font-semibold text-ink">Intensive English</span>
                <span className="text-[15px] font-semibold text-ink">
                  {substitute?.value || '이수 시 인정'}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
