export default function Logo() {
  return (
    <svg className="logo" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect width="26" height="26" rx="7" fill="var(--accent)" />
      <rect x="6.5" y="9" width="3" height="9" rx="1" fill="var(--on-accent)" />
      <rect x="11.5" y="6" width="3" height="10" rx="1" fill="var(--on-accent)" opacity="0.72" />
      <rect x="16.5" y="11" width="3" height="9" rx="1" fill="var(--on-accent)" />
    </svg>
  )
}
