import { getPaperAttemptsProgress, getSubjectSessionsProgress } from '../../../utils/progress-series'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  return {
    papers: getPaperAttemptsProgress(),
    subjects: getSubjectSessionsProgress()
  }
})
