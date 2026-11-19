import { currencyPages, currencyPageMetadata, publicPages } from './shared/public-pages';
import type { Plugin } from 'vite';

const origin = 'https://currencyindicators.vercel.app';

export function publicHtml(): Plugin {
  return {
    name: 'ratewatch-public-html',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const index = bundle['index.html'];
        if (index?.type !== 'asset' || typeof index.source !== 'string') return;
        const template = index.source;
        const entries = [
          ...Object.entries(publicPages),
          ...Object.entries(currencyPages).map(
            ([path, pair]) => [path, currencyPageMetadata(pair)] as const,
          ),
        ];
        const sitemap =
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          entries.map(([path]) => '  <url><loc>' + origin + path + '</loc></url>').join('\n') +
          '\n</urlset>\n';
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
        const links = entries
          .map(([path, [, , heading]]) => '<li><a href="' + path + '">' + heading + '</a></li>')
          .join('');
        for (const [path, [title, description, heading]] of entries) {
          const schema =
            path === '/'
              ? '<script type="application/ld+json">' +
                JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'WebSite',
                  name: 'RateWatch',
                  url: origin + '/',
                }) +
                '</script>'
              : '';
          const html = template
            .replace(/<title>[^<]*<\/title>/, '<title>' + title + ' | RateWatch</title>')
            .replace(
              /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
              '<meta name="description" content="' + description + '" />',
            )
            .replace(
              /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
              '<meta property="og:title" content="' + title + ' | RateWatch" />',
            )
            .replace(
              /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
              '<meta property="og:description" content="' + description + '" />',
            )
            .replace(
              '</head>',
              '<link rel="canonical" href="' +
                origin +
                path +
                '" /><meta property="og:url" content="' +
                origin +
                path +
                '" />' +
                schema +
                '</head>',
            )
            .replace(/<noscript[\s\S]*?<\/noscript>/, '')
            .replace(
              '<div id="root"></div>',
              '<div id="root"><main><h1>' +
                heading +
                '</h1><p>' +
                description +
                '</p><nav aria-label="RateWatch pages"><ul>' +
                links +
                '</ul></nav></main></div>',
            );
          if (path === '/') index.source = html;
          else this.emitFile({ type: 'asset', fileName: path.slice(1) + '.html', source: html });
        }
        const unknown = template.replace(
          '</head>',
          '<meta name="robots" content="noindex, nofollow" /></head>',
        );
        this.emitFile({ type: 'asset', fileName: 'app-shell.html', source: unknown });
      },
    },
  };
}
