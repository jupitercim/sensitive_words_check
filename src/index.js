import React from 'react';
import ReactDOM from 'react-dom/client';

// import '@/common/styles/frame.styl';
// import Popup from '@/popup';
import {ConfigProvider} from "antd";
import Check from "@/content/components/check";
import {RouterProvider} from "react-router-dom";
import {globalRouters} from "./router";


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ConfigProvider>
        <RouterProvider router={globalRouters} />
        {/* <Check /> */}
    </ConfigProvider>
);

