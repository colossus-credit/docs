import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img src="/colossus.jpg" alt="Colossus" className="h-6 w-6" />
          <span>Colossus</span>
        </>
      ),
    },
  };
}
