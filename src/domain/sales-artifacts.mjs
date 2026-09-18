export const SALES_VISUAL_MEDIA_TYPE = 'application/vnd.sales-avatar.visual+json'

function clean(value) {
  return String(value || '').trim()
}

export function createSalesVisualArtifact({ taskId, visual } = {}) {
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) {
    throw new TypeError('visual must be an object')
  }
  const type = clean(visual.type) || 'visual'
  const safeTaskId = clean(taskId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'task'
  return {
    artifactId: `sales_visual_${safeTaskId}`,
    name: type,
    description: `Sales UI artifact: ${type}`,
    parts: [{
      data: structuredClone(visual),
      mediaType: SALES_VISUAL_MEDIA_TYPE,
    }],
  }
}

export function salesVisualFromArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') return null
  for (const part of artifact.parts || []) {
    if (part?.mediaType !== SALES_VISUAL_MEDIA_TYPE) continue
    if (!part.data || typeof part.data !== 'object' || Array.isArray(part.data)) continue
    return structuredClone(part.data)
  }
  return null
}

export function salesVisualsFromArtifacts(artifacts = []) {
  return (Array.isArray(artifacts) ? artifacts : [])
    .map(salesVisualFromArtifact)
    .filter(Boolean)
}
