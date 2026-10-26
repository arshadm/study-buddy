import { getStudentReport } from '../../../../utils/student-report'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  return getStudentReport(id)
})
