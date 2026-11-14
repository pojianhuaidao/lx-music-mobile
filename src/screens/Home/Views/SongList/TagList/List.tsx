import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { View, ScrollView } from 'react-native'

import { createStyle } from '@/utils/tools'
import TagGroup, { type TagGroupProps } from './TagGroup'
import { useI18n } from '@/lang'
import { type TagInfo, type Source } from '@/store/songlist/state'
import { getTags } from '@/core/songlist'
import { useNetRetryRefresh } from '@/utils/useNetRetryRefresh'
import Text from '@/components/common/Text'
// import { BorderWidths } from '@/theme'

export interface ListProps {
  onTagChange: TagGroupProps['onTagChange']
}

export interface ListType {
  loadTag: (source: Source, activeId: string) => void
}

export default forwardRef<ListType, ListProps>(({ onTagChange }, ref) => {
  // const theme = useTheme()
  const [activeId, setActiveId] = useState('')
  const [list, setList] = useState<TagInfo['tags']>([])
  const t = useI18n()
  const prevSource = useRef('')

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    loadTag(source, id) {
      if (id != activeId) setActiveId(id)
      if (source != prevSource.current) {
        setList([{ name: '', list: [{ name: t('songlist_tag_default'), id: '', parent_id: '', parent_name: '', source }] }])
        void getTags(source).then(tagInfo => {
          if (isUnmountedRef.current) return
          prevSource.current = source
          setList([
            { name: '', list: [{ name: t('songlist_tag_default'), id: '', parent_id: '', parent_name: '', source }] },
            { name: t('songlist_tag_hot'), list: [...tagInfo.hotTag] },
            ...tagInfo.tags,
          ].filter(t => t.list.length))
        }).catch((err: unknown) => {
          // 车机开机网络空档期：静默失败，等 netRetry 网络恢复后自动重新加载
          console.warn('[songlist] 标签加载失败', err)
        })
      }
    },
  }))

  const loadTagRef = useRef<(() => void) | null>(null)
  loadTagRef.current = () => {
    const source = prevSource.current
    if (!source) return
    // 强制重新拉取标签（netRetry 已把新数据落库，这里清掉内存态后重载）
    void getTags(source).then(tagInfo => {
      if (isUnmountedRef.current) return
      setList([
        { name: '', list: [{ name: t('songlist_tag_default'), id: '', parent_id: '', parent_name: '', source }] },
        { name: t('songlist_tag_hot'), list: [...tagInfo.hotTag] },
        ...tagInfo.tags,
      ].filter(t => t.list.length))
    }).catch(() => {})
  }
  // 网络恢复后自动补齐标签栏
  useNetRetryRefresh(['tags__'], () => loadTagRef.current?.())


  return (
    <ScrollView style={{ flexShrink: 1, flexGrow: 0 }} keyboardShouldPersistTaps={'always'}>
      <View style={styles.tagContainer} onStartShouldSetResponder={() => true}>
        {
          list.map((type, index) => (
            <TagGroup
              key={index}
              name={type.name}
              list={type.list}
              activeId={activeId}
              onTagChange={onTagChange}
            />
          ))
        }
        {
          list.length == 1
            ? (
                <View style={styles.blankView}>
                  <Text>{t('list_loading')}</Text>
                </View>
              )
            : null
        }
      </View>
    </ScrollView>
  )
})


const styles = createStyle({
  tagContainer: {
    paddingTop: 15,
    paddingLeft: 15,
    paddingBottom: 15,
  },
  blankView: {
    paddingTop: '15%',
    paddingBottom: '15%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
