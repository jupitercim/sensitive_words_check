import React, { useEffect, useRef, useState } from 'react';
import {Button, Badge, Descriptions, Switch, Input, Progress, Space, notification, Checkbox} from 'antd'
import WordConfig from "@/content/components/check/wordconfig";
import {getSensitiveWords, setLocalStorage} from "@/utils/localStorage";
import {isValidUrl, getHost} from '@/utils/common';
function TaskInfo(props) {
    const [auto, setAuto] = useState(true)
    const [screenShotFlag, setScreenShotFlag] = useState(false)
    // 运行状态 default:未运行 processing:运行中 success:完成
    const [runStatus, setRunStatus] = useState("default")
    const [path, setPath] = useState("")
    const [host, setHost] = useState("")
    const [process, setProcess] = useState(0)
    const [duplicatePage, setDuplicatePage] = useState([]);
    const [lanuage, setLanuage] = useState(["en","ru"]);
    const [ignoreUrl, setIgnoreUrl] = useState([]);
    const [tasks, setTasks] = useState(["Words_Check"])
    // 翻译文本比对
    var translationMapping = {};

    // 处理和service-worker的通信
    const port = chrome.runtime.connect({name: "autoScan"});
    port.onMessage.addListener(function(message) {
      console.log("autoScan收到消息：", message)
        if(message.error!==undefined){
          setRunStatus("default");
          notification.open({
              message: 'error',
              description: message.error,
            });
        }else if(message.action === "finish"){
          setRunStatus("success");
          console.log("finish", message)
          // 这里需要判断下截图
          if(screenShotFlag){
            props.setScreenShot(message.screenShot);
          }
          notification.open({
              message: 'finish',
              description: 'task finish.',
            });
        }else if(message.action === "process"){
          setProcess( Math.ceil(message.done / message.total * 100));
        }else if(message.action === "checkResult"){
          // 调用父组件的方法，将结果传递给父组件
          if(message.extra !== undefined){
            console.log("message.checkResult: extra", message.extra)
            // 有额外信息的,格式就没有敏感词了,这里可以做一个访问错误的列表,让用户手工在页面上去访问
            // TODO

          }
          props.setResult(message.checkResult);
        }else if(message.action === "initError"){
          setRunStatus("default");
          notification.open({
              message: 'error',
              description: message.error,
            });
        }else if(message.action === "finalResult"){
          // console.log("finalResult", message)
          setTimeout(()=>{ props.setFinalResult(message.finalResult);},1000)
         
        }
    });

    function setScanHost(value) {
      if(isValidUrl(value)){
        setHost(getHost(value));
      }
    }


    const handleTagsChange = async (newTags) => {
        props.setWords(newTags);
        // 同时也要往chrome.storage.local中存储数据
        await setLocalStorage("sensitiveWordList", newTags);
    };

    async function getSensitiveWordList() {
        // 从chrome.storage.local中获取数据
        const result = await getSensitiveWords();
        if (result.sensitiveWordList) {
            props.setWords(result.sensitiveWordList);
            alert("getSensitiveWordList" + result.sensitiveWordList.toString())
        }    
    }

    const options = [
      {
        label: 'Words Check',
        value: 'Words_Check',
      },
      {
        label: 'Chinese Annotation Detection',
        value: 'Chinese_Annotation_Detection',
      },
      {
        label: 'Translation comparison',
        value: 'Translation_Comparison',
      }
    ];

    function tasksOnchange(tasks) {
      setTasks(tasks)
    }

    const items = [
      {
        key: 'tasks',
        label: 'Tasks',
        children: <Checkbox.Group options={options} defaultValue={tasks} onChange={tasksOnchange} />,
      },
      {
        key: 'auto',
        label: 'Auto Scan',
        children: <Switch checkedChildren="Auto" unCheckedChildren="Manual" defaultChecked onChange={(check)=>setAuto(check)} />,
      },
      {
        key: 'screenShot',
        label: 'ScreenShot',
        children: <Switch checkedChildren="YES" unCheckedChildren="NO" defaultChecked={false} onChange={(check)=>setScreenShotFlag(check)} />,
      },
        {
          key: 'words',
          label: 'Sensitive Word Config',
          children: <WordConfig words={props.words} onTagsChange={handleTagsChange} refresh={getSensitiveWordList}/>,
        },
        {
          key: 'lanuage',
          label: 'Lanuage Config',
          children: <WordConfig words={lanuage} onTagsChange={setLanuage} />,
        },

        {
          key: 'path',
          label: 'Scan Path',
          children: <Input value={path} onChange={(e)=>{setPath(e.target.value)}} placeholder='please enter scan path'/>,
        },
        {
          key: 'host',
          label: 'Scan Host',
          children: <Input value={host} onChange={(e)=>{setScanHost(e.target.value)}} placeholder='please enter scan host'/>,
        },
        {
          key: 'ignore url',
          label: 'Ignore Url',
          children: <WordConfig words={ignoreUrl} onTagsChange={setIgnoreUrl}/>,
        },
        {
          key: 'Duplicate Page',
          label: 'Duplicate Page',
          children: <WordConfig words={duplicatePage} onTagsChange={setDuplicatePage} />,
        },
        {
          key: 'status',
          label: 'Task Status',
          children: <Badge status={runStatus} text={runStatus} />,
        },
        {
          key: 'process',
          label: 'Process',
          children: <Progress percent={process} />,
        },
      ];

    function handleStart() {
        // 清空之前运行的结果
        setLocalStorage("key", {})
        
        // 发送消息给service-worker，开始运行, 将参数发给service-worker
        // words, path
        if((props.words.length===0 && tasks.includes("Words_Check"))) {
          notification.open({
            message: 'task info config is not complete',
            description: 'please check task info config.',
          });
          return;
        }

        if(tasks.includes("Translation_Comparison") && (lanuage.length<=1 ||translationMapping.size===0)){
          notification.open({
            message: 'task info config is not complete',
            description: 'translation comparson need set 2 lanuage at least.',
          });
          return;
        }

        if(isValidUrl(path)===false || host===""){
          notification.open({
            message: 'task info config is not complete',
            description: 'host and path info need be completed.',
          });
          return;
        }

        if(screenShotFlag){
          notification.open({
            message: 'ScreenShot Tips',
            description: 'take screen should let target tab always active, so do not change active tab.Otherwise screenShot will not work.',
          });
        }

        setRunStatus("processing")
        setProcess(0)
        //  清空当前的数据
        props.clearData({});
        // sendStartMessage(props.words, path);
        port.postMessage({
          "action": "startAuto", "words": props.words, "lanuage": lanuage,"translationMapping": translationMapping, "path": path, "host": host, "auto": auto,
          "screenShotFlag": screenShotFlag, "duplicatePage": duplicatePage, "ignoreUrl": ignoreUrl, "tasks": tasks
        });
    }

    function handleStop() {
        setRunStatus("default")
        // 发送消息给service-worker，停止运行
        port.postMessage({"action": "stopAuto"});
    }
 

    return (
        <div>
            <Descriptions size={"small"} title="Task Info" bordered items={items} 
                extra={
                  <Space>
                    {tasks.includes("Translation_Comparison")?<Button type="primary" onClick={()=>{alert("未实现")}}>Load lanuage Mapping</Button>:null}
                    {
                      runStatus==="default"||runStatus==="success"?
                      <Button type="primary" onClick={handleStart}>Start</Button>
                      :
                      <Button type="primary" danger onClick={handleStop}>Stop</Button>

                    }
                  </Space>
                }
            />

        </div>

    );
}

export default TaskInfo