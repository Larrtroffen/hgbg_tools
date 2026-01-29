<script setup lang="ts">
import { useRenderStore } from '@/stores/render'

const renderStore = useRenderStore()
const { readingTime } = storeToRefs(renderStore)
</script>

<template>
  <footer
    class="flex select-none items-center justify-between px-5 py-2 text-xs"
  >
    <span class="text-muted-foreground">@回归不归编辑部</span>
    <div class="space-x-2">
      <span> {{ readingTime.words }} 个词 </span>
      <span> {{ readingTime.chars }} 个字符 </span>
      <span> 阅读大约需 {{ readingTime.minutes }} 分钟 </span>
    </div>
  </footer>
</template>
