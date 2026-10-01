import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import List, { type ListType, type ListProps } from './List'
import ListMenu, { type ListMenuType, type Position } from './ListMenu'
import { type BoardItem } from '@/store/leaderboard/state'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'


export interface BoardsListProps {
  onBoundChange: (listId: string) => void
  onPlay: (listId: string) => void
  onCollect: (listId: string, name: string) => void
  onRecommend: () => void
}
export interface BoardsListType {
  setList: (list: BoardItem[], activeId: string) => void
}

export default forwardRef<BoardsListType, BoardsListProps>(({ onBoundChange, onPlay, onCollect, onRecommend }, ref) => {
  const theme = useTheme()
  const listRef = useRef<ListType>(null)
  const listMenuRef = useRef<ListMenuType>(null)

  useImperativeHandle(ref, () => ({
    setList(list, listId) {
      listRef.current?.setList(list, listId)
    },
  }), [])

  const handleShowMenu: ListProps['onShowMenu'] = ({ listId, name, index }, position: Position) => {
    listMenuRef.current?.show({
      listId,
      index,
      name,
    }, position)
  }

  return (
    <View style={styles.container}>
      <Button style={{ ...styles.recommendButton, borderBottomColor: theme['c-list-header-border-bottom'] }} onPress={onRecommend}>
        <Icon name="play" size={13} color={theme['c-primary-font']} />
        <Text style={styles.recommendText} size={14} color={theme['c-primary-font-active']}>{global.i18n.t('recommend')}</Text>
      </Button>
      <List
        ref={listRef}
        onBoundChange={onBoundChange}
        onShowMenu={handleShowMenu} />
      <ListMenu
        ref={listMenuRef}
        onHideMenu={() => listRef.current?.hideMenu()}
        onPlay={({ listId }) => { onPlay(listId) }}
        onCollect={({ listId, name }) => { onCollect(listId, name) }}
      />
    </View>
  )
})


const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
  },
  recommendButton: {
    paddingLeft: 5,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recommendText: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 6,
  },
})
