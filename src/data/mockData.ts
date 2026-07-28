export type Course = {
  name: string
  credits: number
  code: string
  semester?: string
}

export const userName = '김세종'

export const majorRequiredCompleted: Course[] = [
  { name: '타이포그래피', credits: 3, code: '004264' },
  { name: '3D디자인', credits: 3, code: '010327' },
  { name: '기초렌더링', credits: 2, code: '006225' },
  { name: '비주얼커뮤니케이션디자인1', credits: 2, code: '2008660' },
]

export const majorRequiredRemaining: Course[] = [
  { name: '캡스톤디자인', credits: 3, code: '010311' },
  { name: '디자인방법론', credits: 3, code: '010309' },
]

export const majorElectiveCompleted: Course[] = [
  { name: '서양영화사', credits: 3, code: '004264' },
  { name: '기초3D그래픽스', credits: 3, code: '010327' },
  { name: '기초렌더링', credits: 3, code: '006225' },
  { name: '서양미술사', credits: 2, code: '2008660' },
  { name: '비주얼커뮤니케이션디자인1', credits: 3, code: '010311' },
  { name: '프로덕트디자인1', credits: 3, code: '010309' },
  { name: '비주얼커뮤니케이션디자인2', credits: 3, code: '010312' },
]

export const majorElectiveRemaining: Course[] = [
  { name: '제품시스템캡스톤디자인1', credits: 3, code: '2006754' },
  { name: '그래픽디자인1', credits: 3, code: '010327' },
  { name: '그래픽디자인2', credits: 3, code: '006225' },
  { name: 'AI융합디자인스튜디오', credits: 2, code: '2008660' },
  { name: '아이덴티티디자인', credits: 3, code: '010311' },
  { name: '프로덕트디자인1', credits: 3, code: '010309' },
  { name: '디지털미디어캡스톤디자인프로젝트', credits: 3, code: '010312' },
  { name: 'AI활용UX디자인', credits: 3, code: '010313' },
  { name: '프로덕트&모빌리티디자인', credits: 3, code: '010314' },
  { name: '디지털미디어프로젝트1', credits: 3, code: '010315' },
  { name: '제너레이티브디자인', credits: 3, code: '004264' },
  { name: '스마트프로덕트디자인1', credits: 3, code: '010327' },
  { name: '인포그래픽', credits: 3, code: '006225' },
  { name: '3D그래픽어플리케이션', credits: 2, code: '2008660' },
  { name: '아이덴티티디자인1', credits: 3, code: '010311' },
  { name: '프로덕트&모빌리티디자인1', credits: 3, code: '010309' },
  { name: '제품및운송기기디자인4', credits: 3, code: '010312' },
  { name: '제품및운송기기디자인3', credits: 3, code: '010316' },
  { name: '제품시스템디자인1', credits: 3, code: '010317' },
]

export const engMajorCompleted: Course[] = [
  { name: 'C프로그래밍및실습', credits: 3, code: '2006754' },
  { name: '선형대수', credits: 3, code: '010327' },
  { name: '공업수학1', credits: 3, code: '006225' },
  { name: '고급C프로그래밍및실습', credits: 2, code: '2008660' },
  { name: '자료구조및실습', credits: 3, code: '010311' },
  { name: '디지털시스템', credits: 3, code: '010309' },
  { name: '공학설계기초(산학프로젝트입문)', credits: 3, code: '010312' },
  { name: 'K-MOOC: 모두를위한머신러닝', credits: 3, code: '010313' },
]

export const liberalArtsRequired: Course[] = [
  { name: '대학영어', credits: 3, code: '001001' },
  { name: '서양철학의이해', credits: 3, code: '001002' },
  { name: '문제해결을위한글쓰기와발표', credits: 2, code: '001003' },
  { name: '세종인을위한진로설계', credits: 2, code: '001004' },
]

export const liberalArtsElective: Course[] = [
  { name: '현대사회와윤리', credits: 3, code: '001101' },
  { name: '한국사의이해', credits: 3, code: '001102' },
]

export const bsmCompleted: Course[] = [
  { name: '미적분학1', credits: 3, code: '002001' },
  { name: '미적분학2', credits: 3, code: '002006' },
  { name: '확률및통계', credits: 3, code: '002002' },
  { name: '일반물리학1', credits: 3, code: '002003' },
  { name: '일반물리학실험1', credits: 1, code: '002004' },
]

export const bsmRemaining: Course[] = [
  { name: '공업수학1', credits: 3, code: '002101' },
  { name: '이산수학', credits: 3, code: '002102' },
]

export const designCompleted: Course[] = [
  { name: '공학설계기초(산학프로젝트입문)', credits: 3, code: '010312' },
  { name: '창의설계입문', credits: 3, code: '010320' },
  { name: '소프트웨어공학', credits: 3.3, code: '010321' },
  { name: '시스템분석및설계', credits: 3.3, code: '010322' },
]

export const designRemaining: Course[] = [
  { name: '오픈소스SW공학', credits: 3, code: '010401', semester: '3-1' },
  { name: '데이터베이스', credits: 3, code: '010402', semester: '3-1' },
  { name: '컴퓨터네트워크', credits: 3, code: '010405', semester: '3-2' },
  { name: '운영체제', credits: 3, code: '010406', semester: '3-2' },
  { name: 'Capstone디자인(산학협력프로젝트)', credits: 3, code: '010403', semester: '4-1' },
  { name: '정보보호', credits: 3, code: '010407', semester: '4-1' },
  { name: '인공지능', credits: 3, code: '010408', semester: '4-2' },
  { name: '클라우드컴퓨팅', credits: 3, code: '010404', semester: '4-2' },
]

export const englishRequirements = [
  { label: 'TOEIC', value: '800점 이상' },
  { label: 'TOEFL iBT', value: '80점 이상' },
  { label: 'TEPS', value: '637점 이상' },
  { label: 'New TEPS', value: '348점 이상' },
  { label: 'OPIc', value: 'Intermediate Mid 1 이상' },
  { label: 'TOEIC Speaking', value: 'Intermediate Mid 1 이상' },
  { label: 'G-TELP Level 2', value: '77점 이상' },
  { label: 'G-TELP Speaking Level 4', value: '' },
]

export const classicReading = [
  { category: '서양의 역사와 사상', current: 5, required: 4 },
  { category: '동양의 역사와 사상', current: 3, required: 2 },
  { category: '동·서양의 문학', current: 3, required: 3 },
  { category: '과학 사상', current: 1, required: 1 },
]

export type CurriculumCourse = {
  id: string
  name: string
  hours: string
  category: 'liberal' | 'bsm' | 'major-required' | 'major-elective'
  semester: string
  faded?: boolean
}

export type CurriculumEdge = {
  from: string
  to: string
  type: 'required' | 'optional'
}

export const curriculumCourses: CurriculumCourse[] = [
  { id: 'l1', name: '문제해결을 위한 글쓰기와 발표', hours: '3-0', category: 'liberal', semester: '1-1' },
  { id: 'l2', name: '대학영어', hours: '3-0', category: 'liberal', semester: '1-1' },
  { id: 'l3', name: '서양철학의이해', hours: '3-0', category: 'liberal', semester: '1-2' },
  { id: 'l4', name: '현대사회와윤리', hours: '3-0', category: 'liberal', semester: '2-1' },
  { id: 'b1', name: '미적분학1', hours: '3-0', category: 'bsm', semester: '1-1' },
  { id: 'b2', name: '일반물리학1', hours: '3-0', category: 'bsm', semester: '1-1' },
  { id: 'b3', name: '미적분학2', hours: '3-0', category: 'bsm', semester: '1-2' },
  { id: 'b4', name: '선형대수', hours: '3-0', category: 'bsm', semester: '2-1' },
  { id: 'b5', name: '확률및통계', hours: '3-0', category: 'bsm', semester: '2-2' },
  { id: 'b6', name: '이산수학', hours: '3-0', category: 'bsm', semester: '3-1', faded: true },
  { id: 'm1', name: 'C프로그래밍및실습', hours: '3-1', category: 'major-required', semester: '1-1' },
  { id: 'm2', name: '공학설계기초', hours: '3-0', category: 'major-required', semester: '1-1' },
  { id: 'm3', name: '고급C프로그래밍', hours: '3-1', category: 'major-required', semester: '1-2' },
  { id: 'm4', name: '자료구조및실습', hours: '3-1', category: 'major-required', semester: '2-1' },
  { id: 'm5', name: '디지털시스템', hours: '3-0', category: 'major-required', semester: '2-1' },
  { id: 'm6', name: '알고리즘', hours: '3-0', category: 'major-required', semester: '2-2' },
  { id: 'm7', name: '컴퓨터구조', hours: '3-0', category: 'major-required', semester: '2-2' },
  { id: 'm8', name: '운영체제', hours: '3-0', category: 'major-required', semester: '3-1' },
  { id: 'm9', name: '데이터베이스', hours: '3-0', category: 'major-required', semester: '3-1' },
  { id: 'm10', name: '소프트웨어공학', hours: '3-0', category: 'major-required', semester: '3-2' },
  { id: 'm11', name: 'Capstone 디자인', hours: '3-0', category: 'major-required', semester: '4-1' },
  { id: 'e1', name: '웹프로그래밍', hours: '3-0', category: 'major-elective', semester: '3-2', faded: true },
  { id: 'e2', name: '인공지능개론', hours: '3-0', category: 'major-elective', semester: '3-2', faded: true },
  { id: 'e3', name: '머신러닝', hours: '3-0', category: 'major-elective', semester: '4-1', faded: true },
  { id: 'e4', name: '컴퓨터비전', hours: '3-0', category: 'major-elective', semester: '4-1', faded: true },
  { id: 'e5', name: '클라우드컴퓨팅', hours: '3-0', category: 'major-elective', semester: '4-2', faded: true },
  { id: 'e6', name: '모바일프로그래밍', hours: '3-0', category: 'major-elective', semester: '4-2', faded: true },
]

export const curriculumEdges: CurriculumEdge[] = [
  { from: 'b1', to: 'b3', type: 'required' },
  { from: 'b3', to: 'b4', type: 'required' },
  { from: 'b3', to: 'b5', type: 'optional' },
  { from: 'b4', to: 'b6', type: 'optional' },
  { from: 'm1', to: 'm3', type: 'required' },
  { from: 'm3', to: 'm4', type: 'required' },
  { from: 'm4', to: 'm6', type: 'required' },
  { from: 'm5', to: 'm7', type: 'required' },
  { from: 'm6', to: 'm8', type: 'required' },
  { from: 'm4', to: 'm9', type: 'required' },
  { from: 'm9', to: 'm10', type: 'required' },
  { from: 'm10', to: 'm11', type: 'required' },
  { from: 'm2', to: 'm11', type: 'optional' },
  { from: 'm8', to: 'm11', type: 'required' },
  { from: 'm4', to: 'e1', type: 'optional' },
  { from: 'm6', to: 'e2', type: 'optional' },
  { from: 'e2', to: 'e3', type: 'required' },
  { from: 'e3', to: 'e4', type: 'optional' },
  { from: 'm10', to: 'e5', type: 'optional' },
  { from: 'e1', to: 'e6', type: 'optional' },
]

export const semesters = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'] as const
