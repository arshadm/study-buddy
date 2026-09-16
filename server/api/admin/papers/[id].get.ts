import { getPaperWithSections } from '../../../utils/paper-summary'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))

  const paper = await getPaperWithSections(id)
  if (!paper) {
    throw createError({ statusCode: 404, statusMessage: 'Paper not found' })
  }

  return paper
})
