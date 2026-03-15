import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import serversReducer from './serversSlice'
import usersReducer from './usersSlice'
import serverSetupReducer from './serverSetupSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    servers: serversReducer,
    users: usersReducer,
    serverSetup: serverSetupReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store