import { Link } from 'react-router-dom';

/**
 * Breadcrumb — simple navigation trail
 * items: Array<{ label: string, to?: string }>
 * Last item is current page (no link)
 */
export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Πλοήγηση" className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-white/20" aria-hidden="true">/</span>}
            {!isLast && item.to ? (
              <Link
                to={item.to}
                className="hover:text-text-primary transition-colors hover:underline underline-offset-2"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-text-secondary font-medium' : ''} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
