<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Inbox from '@lucide/svelte/icons/inbox';
  import { session } from '../lib/session.svelte';
  import {
    Badge,
    Button,
    Checkbox,
    Chip,
    Dialog,
    Empty,
    Field,
    HuePicker,
    Input,
    Kbd,
    Picker,
    ProjectIcon,
    Segmented,
    Skeleton,
    Spinner,
    Switch,
    Textarea,
    toasts,
  } from '../lib/ui';
  import StatusIcon from '../components/StatusIcon.svelte';
  import PriorityIcon from '../components/PriorityIcon.svelte';
  import type { Category } from '../lib/types';

  let checked = $state(true);
  let enabled = $state(true);
  let segment = $state<'a' | 'b' | 'c'>('a');
  let dialogOpen = $state(false);
  let hue = $state(235);
  let pick = $state('one');
  let picks = $state<string[]>(['bug']);
  let text = $state('多行输入会随内容自动增高');

  const categories: Category[] = ['backlog', 'active', 'done', 'canceled'];
  const single = [
    { value: 'one', label: '选项一' },
    { value: 'two', label: '选项二', hint: '提示' },
    { value: 'three', label: '选项三' },
  ];
  const multi = [
    { value: 'bug', label: '缺陷', hue: 25 },
    { value: 'feature', label: '新功能', hue: 235 },
    { value: 'balance', label: '平衡性', hue: 135 },
  ];
</script>

<main>
  <header>
    <h1>组件库</h1>
    <Segmented
      items={[{ value: 'system', label: '系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]}
      value={session.theme}
      onchange={(theme) => session.setTheme(theme as typeof session.theme)}
    />
  </header>

  <section>
    <h2>按钮</h2>
    <div class="row">
      <Button variant="primary" icon={Plus}>主要</Button>
      <Button>次要</Button>
      <Button variant="ghost">幽灵</Button>
      <Button variant="danger">危险</Button>
      <Button loading>加载中</Button>
      <Button disabled>禁用</Button>
      <Button size="sm">小</Button>
      <Button size="lg">大</Button>
      <Button icon={Search} tip="提示气泡" aria-label="搜索" />
    </div>
  </section>

  <section>
    <h2>表单</h2>
    <div class="grid">
      <Field label="文本" hint="辅助说明"><Input placeholder="占位文字" /></Field>
      <Field label="带图标"><Input icon={Search} placeholder="搜索" /></Field>
      <Field label="错误状态" error="这里有问题"><Input invalid value="错误的值" /></Field>
      <Field label="多行"><Textarea bind:value={text} /></Field>
    </div>
    <div class="row">
      <Checkbox bind:checked label="复选框" />
      <Switch bind:checked={enabled} label="开关" />
      <Segmented items={[{ value: 'a', label: '看板' }, { value: 'b', label: '列表' }, { value: 'c', label: '版本' }]} bind:value={segment} />
      <HuePicker bind:value={hue} />
    </div>
  </section>

  <section>
    <h2>选择器</h2>
    <div class="row">
      <Picker items={single} value={pick} onselect={(v) => (pick = v)}>
        {#snippet trigger(props)}<Button {...props}>单选：{pick}</Button>{/snippet}
      </Picker>
      <Picker
        items={multi}
        value={picks}
        multiple
        searchable
        onselect={(v) => (picks = picks.includes(v) ? picks.filter((p) => p !== v) : [...picks, v])}
        oncreate={() => toasts.show('创建回调')}
      >
        {#snippet trigger(props)}<Button {...props}>多选：{picks.length}</Button>{/snippet}
      </Picker>
    </div>
  </section>

  <section>
    <h2>展示</h2>
    <div class="row">
      <Badge>中性</Badge>
      <Badge tone="accent">强调</Badge>
      <Badge tone="success">成功</Badge>
      <Badge tone="warning">警告</Badge>
      <Chip label="中性标签" />
      <Chip label="平衡性" hue={135} />
      <Chip label="可移除" hue={25} onremove={() => {}} />
      <Kbd>⌘</Kbd><Kbd>K</Kbd>
      <Spinner />
    </div>
    <div class="row">
      {#each categories as category (category)}<StatusIcon {category} size={16} />{/each}
      {#each [0, 1, 2, 3, 4] as priority (priority)}<PriorityIcon {priority} size={16} />{/each}
      {#each [25, 85, 165, 235, 300] as h (h)}<ProjectIcon name="项目" {hue} size={28} icon={h === 85 ? '🚀' : ''} />{/each}
    </div>
    <div class="skeletons"><Skeleton width="60%" /><Skeleton width="85%" /></div>
  </section>

  <section>
    <h2>反馈</h2>
    <div class="row">
      <Button onclick={() => (dialogOpen = true)}>打开对话框</Button>
      <Button onclick={() => toasts.show('已保存')}>提示</Button>
      <Button onclick={() => toasts.show('已删除卡片', { action: { label: '撤销', run: () => {} } })}>可撤销提示</Button>
      <Button onclick={() => toasts.error('出错了')}>错误提示</Button>
    </div>
    <Empty icon={Inbox} title="空状态" description="解释这里为什么是空的，以及下一步可以做什么。">
      <Button variant="primary">主要操作</Button>
    </Empty>
  </section>
</main>

<Dialog bind:open={dialogOpen} title="对话框标题" description="描述这个操作的后果。">
  <Field label="名称"><Input /></Field>
  {#snippet footer()}
    <Button onclick={() => (dialogOpen = false)}>取消</Button>
    <Button variant="primary" onclick={() => (dialogOpen = false)}>确认</Button>
  {/snippet}
</Dialog>

<style>
  main {
    flex: 1;
    max-width: 860px;
    height: 100%;
    margin: 0 auto;
    padding: 28px 24px 64px;
    overflow-y: auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  h1 {
    font-size: var(--fs-2xl);
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  section {
    margin-bottom: 14px;
    padding: 16px 18px;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  h2 {
    margin-bottom: 12px;
    color: var(--text-2);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 12px;
  }
  .skeletons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }
</style>
