import { getStudentReport } from '../../utils/student-report'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, 'student')

  return getStudentReport(user!.id)
})
