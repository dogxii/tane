<script lang="ts">
  import { session } from '../lib/session.svelte';
  import { Dialog, Kbd } from '../lib/ui';

  const groups = [
    {
      title: '全局',
      items: [
        [['⌘', 'K'], '打开命令面板'],
        [['?'], '查看快捷键'],
      ],
    },
    {
      title: '项目',
      items: [
        [['C'], '新建卡片'],
        [['/'], '搜索筛选'],
        [['B'], '看板'],
        [['L'], '列表'],
        [['F'], '反馈收件箱'],
        [['R'], '版本'],
      ],
    },
    {
      title: '鼠标悬停在卡片上时',
      items: [
        [['↵'], '打开卡片'],
        [['D'], '完成或取消完成'],
      ],
    },
  ] as const;
</script>

<Dialog bind:open={session.shortcutsOpen} title="键盘快捷键" width={380}>
  {#each groups as group (group.title)}
    <h3>{group.title}</h3>
    {#each group.items as [keys, label] (label)}
      <div class="row">
        <span>{label}</span>
        <span class="keys">{#each keys as key (key)}<Kbd>{key}</Kbd>{/each}</span>
      </div>
    {/each}
  {/each}
</Dialog>

<style>
  h3 {
    margin: 12px 0 4px;
    color: var(--text-3);
    font-size: var(--fs-xs);
    font-weight: 500;
  }
  h3:first-child {
    margin-top: 0;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 30px;
    font-size: var(--fs-sm);
  }
  .keys {
    display: inline-flex;
    gap: 3px;
  }
</style>
