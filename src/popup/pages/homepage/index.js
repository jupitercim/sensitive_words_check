import React from 'react';
import {Button } from 'antd';


function HomePage() {
    async function CheckNewTabStatus(event) {
        const tabs = await chrome.tabs.query({title: "Sensitive Word Check"})

        // 如果tab存在，则直接Focus到这个tab
        if(tabs.length!=0){
            chrome.tabs.update(tabs[0].id, {active: true})
        }else{
            // 使用window.open打开新的标签页
            var extensionId = chrome.runtime.id;
            const newTab = window.open(`chrome-extension://${extensionId}/index.html#/check`, '_blank');
            // 确保新的标签页在前台打开
            if (newTab) newTab.focus();
            
        }
    
    }

    return (
        <div>
            <Button onClick={CheckNewTabStatus}>Active New Page</Button>
        </div>
    )
}
export default HomePage