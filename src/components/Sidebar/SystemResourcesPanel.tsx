import { useMemo } from 'react'

import { useSystemResources } from '../../hooks/useSystemResources'

const GIB = 1024 ** 3
const MIB = 1024 * 1024

function gibFigure(bytes: number) {
  return bytes >= 10 * GIB ? `${Math.round(bytes / GIB)}` : (bytes / GIB).toFixed(1)
}

function memoryFigure(bytes: number | null) {
  if (bytes === null || !Number.isFinite(bytes)) {
    return '—'
  }
  if (bytes >= GIB) {
    return `${gibFigure(bytes)} GB`
  }
  if (bytes >= MIB) {
    return `${Math.round(bytes / MIB)} MB`
  }

  return `${Math.round(bytes / 1024)} KB`
}

function shortCpuName(model: string) {
  return model
    .replace(/\((?:R|TM)\)/gi, ' ')
    .replace(/\s*CPU\s*@\s*[\d.]+\s*GHz\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Without an NVIDIA driver the gateway has no card to report, so the browser's own adapter
 * string is the only name available, and it arrives wrapped in ANGLE metadata.
 */
function shortAdapterName(raw: string) {
  const parts = raw
    .replace(/^ANGLE\s*\(/i, '')
    .replace(/\)$/, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const named = parts.find((part) => !/^(?:nvidia|intel|amd|apple|microsoft)(?: corporation)?$/i.test(part) && !part.startsWith('(0x')) ?? parts[0] ?? ''

  return named
    .replace(/\s*\(0x[0-9a-f]+\)/i, '')
    .replace(/\s+(?:direct3d\d+|opengl|vulkan|vs_\d+).*$/i, '')
    .replace(/^(?:NVIDIA|AMD)\s+(?:GeForce|Radeon)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readAdapterName() {
  try {
    const context = document.createElement('canvas').getContext('webgl')
    const details = context?.getExtension('WEBGL_debug_renderer_info')
    if (!context || !details) {
      return ''
    }

    return shortAdapterName(String(context.getParameter(details.UNMASKED_RENDERER_WEBGL) ?? ''))
  } catch {
    return ''
  }
}

function meterState(percent: number) {
  if (percent >= 90) {
    return 'critical'
  }
  if (percent >= 75) {
    return 'warn'
  }

  return ''
}

type ResourceRow = {
  label: string
  name: string
  title: string
  percent: number | null
  value: string
}

function SystemResourcesPanel() {
  const resources = useSystemResources()
  const adapterName = useMemo(readAdapterName, [])

  if (!resources) {
    return (
      <section className="sidebar-resources">
        <h2 className="sidebar-resources-title">This computer</h2>
        <p className="sidebar-resources-empty">No reading from the gateway.</p>
      </section>
    )
  }

  const { cpu, memory, gpu, app } = resources
  const rows: ResourceRow[] = [
    {
      label: 'GPU',
      name: gpu ? `${shortAdapterName(gpu.name)}${gpu.percent === null ? '' : ` · ${gpu.percent}%`}` : adapterName,
      title: gpu ? `${gpu.name}${gpu.percent === null ? '' : ` · ${gpu.percent}% of the card in use`}` : (adapterName || 'No graphics adapter reported'),
      percent: gpu ? Math.round((gpu.memoryUsedBytes / Math.max(1, gpu.memoryTotalBytes)) * 100) : null,
      value: gpu ? `${gibFigure(gpu.memoryUsedBytes)} of ${Math.round(gpu.memoryTotalBytes / GIB)} GB` : '—',
    },
    {
      label: 'CPU',
      name: shortCpuName(cpu.model),
      title: `${cpu.model} · ${cpu.cores} cores`,
      percent: cpu.percent,
      value: cpu.percent === null ? 'measuring' : `${cpu.percent}%`,
    },
    {
      label: 'RAM',
      name: '',
      title: `${gibFigure(memory.usedBytes)} of ${gibFigure(memory.totalBytes)} GB in use`,
      percent: Math.round((memory.usedBytes / Math.max(1, memory.totalBytes)) * 100),
      value: `${gibFigure(memory.usedBytes)} of ${Math.round(memory.totalBytes / GIB)} GB`,
    },
  ]

  return (
    <section className="sidebar-resources" aria-label="This computer">
      <h2 className="sidebar-resources-title">This computer</h2>

      {rows.map((row) => (
        <div className="resource-row" key={row.label} title={row.title}>
          <span className="resource-row-label">{row.label}</span>
          <span className="resource-row-name">{row.name}</span>
          <span className={`resource-meter ${row.percent === null ? '' : meterState(row.percent)}`.trim()} aria-hidden="true">
            {row.percent === null ? null : <i style={{ width: `${Math.min(100, row.percent)}%` }} />}
          </span>
          <span className="resource-row-value">{row.value}</span>
        </div>
      ))}

      <div className="resource-row resource-row-app">
        <span className="resource-row-name">{app.scope === 'app' ? 'Lampstand' : 'Gateway service'}</span>
        <span className="resource-row-value">{memoryFigure(app.bytes)}</span>
      </div>
    </section>
  )
}

export default SystemResourcesPanel
