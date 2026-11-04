import type { DigestNight, DigestRow } from '../digest/types.js';

// The styleguide's missing-data mark (U+2014).
export const MISSING = '\u2014';

export const RETRY_MARK_AT = 3;

function marks(row: DigestRow): string[] {
  const out: string[] = [];
  if (row.retries >= RETRY_MARK_AT) out.push(`${row.retries} retries`);
  if (row.fails > 0) out.push(`${row.fails} fail${row.fails === 1 ? '' : 's'}`);
  return out;
}

export function DigestPage({ night }: { night: DigestNight }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} did not parse
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => {
              const m = marks(row);
              return (
                <tr class={m.length > 0 ? 'warn' : undefined}>
                  <td>
                    {row.job}
                    {m.length > 0 && <strong> [WARN: {m.join(', ')}]</strong>}
                  </td>
                  <td>{row.owner ?? MISSING}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.fails}</td>
                  <td>{row.lastStatus}</td>
                  <td class="err">{row.lastError ?? MISSING}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function DigestNotFound({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="warn">no run log for this night</p>
    </>
  );
}
