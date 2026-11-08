import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { auth, resolveActor } from './auth';
import { cards, collect } from './cards';
import { listProjects, projects } from './projects';
import { ApiError, type App, type Env } from './util';

const app = new Hono<App>().basePath('/api');

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status as 400);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'http_error', message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: 'internal', message: '服务器出错了' } }, 500);
});

app.notFound((c) => c.json({ error: { code: 'not_found', message: '接口不存在' } }, 404));

app.use('*', resolveActor);
// One request tells the app who is signed in and what to show in the sidebar.
app.get('/me', async (c) => {
  const actor = c.get('actor');
  return c.json({ actor, projects: actor ? await listProjects(c) : [] });
});
app.route('/', auth);
app.route('/projects', cards);
app.route('/projects', projects);
app.route('/collect', collect);

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
