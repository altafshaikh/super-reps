import type { VercelRequest, VercelResponse } from '@vercel/node';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const config = {
  maxDuration: 60,
};

function normalizeHevyRoutineUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const t = input.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.endsWith('hevy.com')) return null;
    const m = u.pathname.match(/\/routine\/([^/?#]+)/);
    if (!m?.[1]) return null;
    return `https://hevy.com/routine/${m[1]}`;
  } catch {
    return null;
  }
}

/**
 * Server-side only: headless Chromium loads the public Hevy routine page (no CORS),
 * waits for content, returns title + body text for the app importer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let payload = req.body as { url?: string } | string;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload) as { url?: string };
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }

  const targetUrl = normalizeHevyRoutineUrl(payload?.url);
  if (!targetUrl) {
    res.status(400).json({ error: 'Expected JSON { "url": "https://hevy.com/routine/…" }' });
    return;
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45_000 });

    try {
      await page.waitForFunction(
        () => {
          const t = document.body?.innerText ?? '';
          return !t.includes('Loading...') && t.length > 400;
        },
        { timeout: 28_000 },
      );
    } catch {
      /* still return partial DOM text */
    }

    await new Promise((r) => setTimeout(r, 1200));

    const pageTitle = ((await page.title()) || '').replace(/\s*\|\s*Hevy.*$/i, '').trim();
    const text = await page.evaluate(() => document.body?.innerText ?? '');

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      title: pageTitle || 'Imported routine',
      text,
      source: 'puppeteer',
    });
  } catch (e) {
    console.error('[hevy-routine]', e);
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Headless fetch failed',
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
