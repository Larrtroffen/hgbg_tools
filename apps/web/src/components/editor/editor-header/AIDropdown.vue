<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { useUIStore } from '@/stores/ui'

const props = withDefaults(defineProps<{
  asSub?: boolean
}>(), {
  asSub: false,
})

const uiStore = useUIStore()
const { asSub } = toRefs(props)

function openAIDialog() {
  uiStore.toggleAIDialog(true)
}
</script>

<template>
  <!-- 作为 MenubarSub 使用（移动端） -->
  <MenubarSub v-if="asSub">
    <MenubarSubTrigger>
      AI
    </MenubarSubTrigger>
    <MenubarSubContent align="start">
      <MenubarItem @click="openAIDialog()">
        <Bot class="mr-2 h-4 w-4" />
        Dify 工作流
      </MenubarItem>
    </MenubarSubContent>
  </MenubarSub>

  <!-- 作为 MenubarMenu 使用（桌面端） -->
  <MenubarMenu v-else>
    <MenubarTrigger>AI</MenubarTrigger>
    <MenubarContent align="start">
      <MenubarItem @click="openAIDialog()">
        <Bot class="mr-2 h-4 w-4" />
        Dify 工作流
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</template>
