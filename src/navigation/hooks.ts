import { useEffect } from 'react'
import { Navigation } from 'react-native-navigation'

export const useNavigationComponentDidAppear = (componentId: string, callback = () => {}) => {
  useEffect(() => {
    const listener = {
      componentDidAppear: () => {
        callback()
      },
    }
    // Register the listener to all events related to our component
    const unsubscribe = Navigation.events().registerComponentListener(listener, componentId)
    return () => {
      // Make sure to unregister the listener during cleanup
      unsubscribe.remove()
    }
  }, [callback, componentId])
}

export const onNavigationComponentDidDisappearEvent = (componentId: string, callback = () => {}) => {
  const listener = {
    componentDidDisappear: () => {
      callback()
    },
  }
  const unsubscribe = Navigation.events().registerComponentListener(listener, componentId)
  return unsubscribe
}

