import { useId } from 'react'
import type { PaperDiagram } from '../../../shared/types'
import './FrameworkDiagram.css'

const NODE_WIDTH = 240
const NODE_HEIGHT = 134
const COLUMN_GAP = 102
const ROW_GAP = 122
const PADDING_X = 28
const PADDING_TOP = 72
const PADDING_BOTTOM = 84

type PositionedNode = PaperDiagram['nodes'][number] & { x: number; y: number }
type Connector = { path: string; labelX: number; labelY: number }

/** Orthogonal routes stay in the gaps, including skip links and feedback loops. */
function connector(from: PositionedNode, to: PositionedNode): Connector {
  const centerX = (node: PositionedNode) => node.x + NODE_WIDTH / 2
  const centerY = (node: PositionedNode) => node.y + NODE_HEIGHT / 2
  if (from.row === to.row) {
    const forward = to.column > from.column
    if (Math.abs(to.column - from.column) === 1) {
      const startX = from.x + (forward ? NODE_WIDTH + 2 : -2)
      const endX = to.x + (forward ? -5 : NODE_WIDTH + 5)
      const y = centerY(from)
      return { path: `M ${startX} ${y} H ${endX}`, labelX: (startX + endX) / 2, labelY: y - 15 }
    }
    // Skip an intermediate node above the row; route feedback below the row.
    const startY = from.y + (forward ? -2 : NODE_HEIGHT + 2)
    const endY = to.y + (forward ? -5 : NODE_HEIGHT + 5)
    const laneY = from.y + (forward ? -36 : NODE_HEIGHT + 40)
    return {
      path: `M ${centerX(from)} ${startY} V ${laneY} H ${centerX(to)} V ${endY}`,
      labelX: (centerX(from) + centerX(to)) / 2,
      labelY: laneY + (forward ? -15 : 18),
    }
  }
  const downward = to.row > from.row
  const startY = from.y + (downward ? NODE_HEIGHT + 2 : -2)
  const endY = to.y + (downward ? -5 : NODE_HEIGHT + 5)
  if (from.column === to.column) {
    const x = centerX(from)
    return { path: `M ${x} ${startY} V ${endY}`, labelX: x + 47, labelY: (startY + endY) / 2 }
  }
  // Offset diagonal ports from center ports so a vertical edge remains distinct.
  const rightward = to.column > from.column
  const startX = from.x + NODE_WIDTH * (rightward ? 0.74 : 0.26)
  const endX = to.x + NODE_WIDTH * (rightward ? 0.26 : 0.74)
  const laneY = (startY + endY) / 2
  return {
    path: `M ${startX} ${startY} V ${laneY} H ${endX} V ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: laneY - 15,
  }
}

export function FrameworkDiagram({ diagram }: { diagram: PaperDiagram }) {
  const componentId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const titleId = `framework-title-${componentId}`
  const descriptionId = `framework-description-${componentId}`
  const arrowId = `framework-arrow-${componentId}`
  const nodes = diagram.nodes.map((node): PositionedNode => ({
    ...node,
    x: PADDING_X + node.column * (NODE_WIDTH + COLUMN_GAP),
    y: PADDING_TOP + node.row * (NODE_HEIGHT + ROW_GAP),
  }))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const columns = Math.max(1, ...nodes.map((node) => node.column + 1))
  const rows = Math.max(1, ...nodes.map((node) => node.row + 1))
  const width = PADDING_X * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP
  const height = PADDING_TOP + PADDING_BOTTOM + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP
  const caption = diagram.caption.includes('非论文原图') ? diagram.caption : `${diagram.caption} 根据论文内容重绘，非论文原图。`
  const edges = diagram.edges.flatMap((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    return from && to ? [{ ...edge, fromNode: from, toNode: to, ...connector(from, to) }] : []
  })

  return (
    <figure className="framework-diagram">
      <div className="framework-diagram__heading"><strong>{diagram.title}</strong><span>可横向滚动查看</span></div>
      <div className="framework-diagram__scroll" tabIndex={0} role="region" aria-label={`${diagram.title}，可横向滚动；下方提供文字说明`}>
        <svg className="framework-diagram__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>{diagram.title}</title>
          <desc id={descriptionId}>{caption} 共 {nodes.length} 个模块、{edges.length} 条连接。完整节点与连接见图后可展开的文字说明。</desc>
          <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="8" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#6383ac" /></marker></defs>
          <g aria-hidden="true">
            {edges.map((edge, index) => <path className="framework-diagram__edge" key={`edge-${index}`} d={edge.path} markerEnd={`url(#${arrowId})`} />)}
            {edges.map((edge, index) => edge.label ? <g key={`label-${index}`}>
              <rect className="framework-diagram__edge-label-bg" x={edge.labelX - Math.max(44, edge.label.length * 12 + 14) / 2} y={edge.labelY - 12} width={Math.max(44, edge.label.length * 12 + 14)} height="23" rx="5" />
              <text className="framework-diagram__edge-label" x={edge.labelX} y={edge.labelY + 4} textAnchor="middle">{edge.label}</text>
            </g> : null)}
            {nodes.map((node, index) => <g key={node.id}>
              <rect className={`framework-diagram__node-background${node.row % 2 ? ' framework-diagram__node-background--alternate' : ''}`} x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="12" />
              <foreignObject x={node.x + 1} y={node.y + 1} width={NODE_WIDTH - 2} height={NODE_HEIGHT - 2}>
                <div className="framework-diagram__node"><div className="framework-diagram__node-heading"><span>{String(index + 1).padStart(2, '0')}</span><strong>{node.title}</strong></div><p>{node.detail}</p></div>
              </foreignObject>
            </g>)}
          </g>
        </svg>
      </div>
      <figcaption className="framework-diagram__caption">{caption}</figcaption>
      <details className="framework-diagram__text"><summary>展开框架图的文字说明</summary><ol>{nodes.map((node) => <li key={node.id}><strong>{node.title}</strong>：{node.detail}</li>)}</ol><p>模块连接</p><ul>{edges.map((edge, index) => <li key={index}>{edge.fromNode.title} → {edge.toNode.title}{edge.label ? `（${edge.label}）` : ''}</li>)}</ul></details>
    </figure>
  )
}
