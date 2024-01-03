import { createHashRouter, Navigate } from 'react-router-dom'
import HomePage from "@/popup/pages/homepage";
import Check from "@/content/components/check";

// 全局路由
export const globalRouters = createHashRouter([
    {
        path: '/',
        element: <HomePage />,
    },
    {
        path: '/check',
        element: <Check />,
    },
])