import { createHashRouter, Navigate } from 'react-router-dom'
import Check from "@/content/components/check";

// 全局路由
export const globalRouters = createHashRouter([
    {
        path: '/check',
        element: <Check />,
    },
])