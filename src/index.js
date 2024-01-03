import React from 'react';
import ReactDOM from 'react-dom/client';

import '@/common/styles/frame.styl';
import Popup from '@/popup';
import {ConfigProvider} from "antd";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ConfigProvider>
        <Popup />
    </ConfigProvider>
);

