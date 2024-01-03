
import React, { useEffect, useRef, useState } from 'react';
import TaskInfo from '@/content/components/check/taskinfo'
import ResultTable from '@/content/components/check/resultTable'
import { Button, Space } from 'antd';

// import './check.styl'
function Check() {
    // 从localStorage中获取数据， 敏感词设置
    const [isLoaded, setIsLoaded] = useState(false);
    const [words, setWords] = useState([]);
    const [checkResult, setCheckResult] = useState({});


    useEffect(() => {
        setIsLoaded(false);
        const fetchData = async () => {
            // 从chrome.storage.local中获取数据
            chrome.storage.local.get("sensitiveWordList", function(result) {
                if (result.sensitiveWordList) {
                    setWords(result.sensitiveWordList);
                }
            });
        }
        fetchData();
        setIsLoaded(true);
    }, []);


    function setResult(data) {
        // 将获取的数据组合成{}, 每一个key都是敏感词, value是一个数组，包含的是检测结果
        // {word1: [result1, result2], word2: [result1, result2]}
        try{
            const tempCheckResult = {...checkResult};
            Object.keys(data['words']).forEach((word, index) => {
                if(tempCheckResult[word] === undefined){
                    tempCheckResult[word] = [];
                }
                tempCheckResult[word] = [...tempCheckResult[word], data["words"][word]];
            });
            setCheckResult(tempCheckResult);
        }catch(e){
            console.log("setResult error", e)
        }
    }

    function dealScreenShot(screenShots) {
        if(Object.keys(screenShots).length === 0){
            return;
        }
        try{
            const tempCheckResult = {...checkResult};
            Object.keys(tempCheckResult).forEach((word, index) => {
                tempCheckResult[word].forEach((result, index) => {
                    console.log("tempCheckResult[word].forEach", result, screenShots[result['page']])
                    if(result['type'] === "Document" || result["hit"]){
                        screenShots[result['page']] === undefined?'':result['screenShot'] = screenShots[result['page']];
                    }
                })
            });
            setCheckResult(tempCheckResult);
            console.log("dealScreenShot", tempCheckResult)
        }catch(e){
            console.log("setResult error", e)
        }       
    }


    return (
        <Space
            direction="vertical"
            size="middle"
            style={{
                display: 'flex',
            }}
        >
             <TaskInfo words={words} setWords={setWords} setResult={setResult} setScreenShot={dealScreenShot} clearData={setCheckResult} setFinalResult={setCheckResult}/>
            {isLoaded && <ResultTable words={['Chinese Annotation Detection'].concat(words)} checkResult={checkResult}/>}
        </Space>
        
    )
}

export default Check