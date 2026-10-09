import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  useEffect(() => { document.title = '页面未找到 · arXiv Daily'; window.scrollTo({ top: 0, left: 0 }) }, [])
  return <div className="site-shell"><main className="not-found"><p className="eyebrow">404</p><h1>页面不存在</h1><p>这个地址没有对应的论文或页面。</p><Link className="button-link" to="/">返回首页</Link></main></div>
}
