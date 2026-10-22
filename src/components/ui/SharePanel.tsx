import { useMemo, useState } from 'react'
import { Share2, X, Copy, Check, Download } from 'lucide-react'
import dayjs from 'dayjs'
import usePlanetariumStore from '@/store/usePlanetariumStore'
import { buildShareUrl, type ShareOptions } from '@/store/shareLink'
import { captureImage } from '@/engine/capture'

const DIRECTIONS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
const direction = (az: number) => DIRECTIONS[Math.round((((az % 360) + 360) % 360) / 45) % 8]

/** Copies text; falls back to a hidden textarea where the async clipboard is unavailable (plain http, old browsers). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/** A button that opens the share panel: a link to this view, and a PNG of the sky. */
export default function SharePanel() {
  const [open, setOpen] = useState(false)
  const locationSource = usePlanetariumStore((s) => s.locationSource)
  const [options, setOptions] = useState<ShareOptions>({
    includeTime: true,
    // A GPS fix is the viewer's exact position: leave it out unless they say so.
    includeLocation: locationSource !== 'gps',
    includeView: true,
  })
  const [caption, setCaption] = useState(true)
  const [stamp, setStamp] = useState(0)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const [saving, setSaving] = useState<'busy' | 'fail' | null>(null)

  // The link follows the options, and is rebuilt on open and on copy: the time and view move on while the panel is shut.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` only forces a rebuild
  const url = useMemo(() => (open ? buildShareUrl(options) : ''), [open, options, stamp])

  const toggle = (key: keyof ShareOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }))

  const copy = async () => {
    const fresh = buildShareUrl(options)
    setStamp((n) => n + 1)
    setCopied((await copyText(fresh)) ? 'ok' : 'fail')
    setTimeout(() => setCopied(null), 2000)
  }

  const save = async () => {
    const s = usePlanetariumStore.getState()
    const lines = caption
      ? [
          dayjs(s.simulatedTime).format('YYYY-MM-DD HH:mm:ss (UTC Z)'),
          `${s.locationName || '観測地'}  ${s.latitude >= 0 ? 'N' : 'S'}${Math.abs(s.latitude).toFixed(2)}° ${s.longitude >= 0 ? 'E' : 'W'}${Math.abs(s.longitude).toFixed(2)}°`,
          `視野 ${s.fov.toFixed(0)}° ・ ${direction(s.viewAzimuth)} ${s.viewAzimuth.toFixed(0)}°`,
        ]
      : []
    setSaving('busy')
    const blob = await captureImage(lines)
    if (!blob) {
      setSaving('fail')
      return
    }
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `planetarium_${dayjs(s.simulatedTime).format('YYYYMMDD-HHmmss')}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
    setSaving(null)
  }

  const nativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div data-no-labels className="absolute top-4 right-52 z-30">
      <button
        onClick={() => setOpen(!open)}
        title="共有・画像保存"
        className="p-2 bg-black/70 backdrop-blur border border-white/20 rounded-full text-white/60 hover:text-white transition"
      >
        <Share2 size={16} />
      </button>

      {open && (
        <div data-no-labels className="absolute top-12 right-0 w-80 max-h-[calc(100vh-7rem)] overflow-y-auto bg-black/85 backdrop-blur border border-white/20 rounded-xl p-4 text-white shadow-xl">
          <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white">
            <X size={14} />
          </button>

          <div className="text-xs font-semibold text-white/60 mb-2 tracking-wider">この空へのリンク</div>
          <div className="space-y-1.5 text-sm mb-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={options.includeTime} onChange={() => toggle('includeTime')} />
              <span>
                日時を含める
                <span className="block text-[11px] text-white/45">開くと、この日時で止まった状態になります。外すと、開いた人の現在時刻で動きます。</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={options.includeLocation} onChange={() => toggle('includeLocation')} />
              <span>
                観測地を含める
                {locationSource === 'gps' && (
                  <span className="block text-[11px] text-amber-300/80">GPS で取得した現在地の座標が、リンクに入ります。</span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={options.includeView} onChange={() => toggle('includeView')} />
              <span>向きと視野を含める</span>
            </label>
          </div>

          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="共有リンク"
            className="w-full bg-white/10 rounded px-2 py-1.5 text-[11px] font-mono text-white/80 outline-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={copy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs py-1.5 transition"
            >
              {copied === 'ok' ? <Check size={13} /> : <Copy size={13} />}
              {copied === 'ok' ? 'コピーしました' : copied === 'fail' ? 'コピーできません' : 'リンクをコピー'}
            </button>
            {nativeShare && (
              <button
                onClick={() => navigator.share({ title: '星空', url }).catch(() => {})}
                className="px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition"
              >
                共有…
              </button>
            )}
          </div>

          <div className="border-t border-white/15 mt-4 pt-3">
            <div className="text-xs font-semibold text-white/60 mb-2 tracking-wider">画像として保存</div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input type="checkbox" checked={caption} onChange={() => setCaption(!caption)} />
              <span>日時・場所・向きを書き込む</span>
            </label>
            <button
              onClick={save}
              disabled={saving === 'busy'}
              className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-xs py-1.5 transition"
            >
              <Download size={13} />
              {saving === 'busy' ? '保存しています…' : 'PNG で保存'}
            </button>
            {saving === 'fail' && <div className="text-xs text-red-300 mt-1.5">画像を作れませんでした。もう一度お試しください。</div>}
            <div className="text-[11px] text-white/40 mt-2 leading-relaxed">いま画面に出ている空（星・ラベル・軌跡など）を保存します。ボタンやパネルは入りません。</div>
          </div>
        </div>
      )}
    </div>
  )
}
