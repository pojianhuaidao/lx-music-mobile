// @flow

import { useEffect, useReducer, useRef } from 'react'
import { Navigation } from 'react-native-navigation'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  // Setting,
} from '@/screens'
import { Provider } from '@/store/Provider'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  PACT_MODAL,
  UPDATE_MODAL,
  // SETTING_SCREEN,
} from './screenNames'
import PactModal from './components/PactModal'
import UpdateModal from './components/UpdateModal'

/**
 * 屏幕包装器：消费 refreshTick。
 *
 * MainActivity 在画中画/系统小窗进出、点击图标恢复时会通过 updateProps 下发
 * refreshTick，但此前没有任何屏幕消费该属性，刷新形同空操作，导致小窗画面
 * 停留在旧状态。这里监听 refreshTick 变化并强制重渲染当前屏幕。
 */
function WrappedComponent(Component: any) {
  // 注意：包装后的组件类型必须保持稳定（不能在 props 更新时重新创建），
  // 否则 updateProps 会换来一个新的组件类型，导致 React 卸载重建整棵子树
  // （页面状态丢失、闪屏），这里直接返回同一个函数组件。
  return function EnhancedScreen(props: Record<string, any>) {
    const [, forceUpdate] = useReducer((tick: number) => tick + 1, 0)
    const tickRef = useRef(props.refreshTick)

    useEffect(() => {
      if (tickRef.current === props.refreshTick) return
      tickRef.current = props.refreshTick
      forceUpdate()
    }, [props.refreshTick])

    return (
      <Provider>
        <Component
          {...props}
        />
      </Provider>
    )
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(UPDATE_MODAL, () => WrappedComponent(UpdateModal))
  // Navigation.registerComponent(SETTING_SCREEN, () => WrappedComponent(Setting))

  console.info('All screens have been registered...')
}
