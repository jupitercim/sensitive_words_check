import { Tabs, Divider, Table, Image,Tooltip ,Button } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircleTwoTone, ExclamationCircleTwoTone, SmileTwoTone } from '@ant-design/icons';
import ReactJson from 'react-json-view'
import { getPathWithoutParams } from '@/utils/common';
import { onExportBasicExcel } from '@/utils/excel';


function ResultTable(props)  {
    const columns = [
        {
          title: 'Page',
          width: 100,
          dataIndex: 'page',
          key: 'page',
          // fixed: 'left',
          render: (text, record) => {
            return  <Tooltip placement="topLeft" title={record['page']}>
                       {getPathWithoutParams(record['page'])}
                    </Tooltip> 
          }
        },
        {
          title: 'Page ScreenShot',
          width: 100,
          dataIndex: 'screenShot',
          key: 'screenShot',
          // fixed: 'left',
          render: (text, record) => {
            return <Image src={record.screenShot}/>
          }
        },
        {
          title: 'URL',
          width: 100,
          dataIndex: 'url',
          key: 'url',
          // fixed: 'left',
          render: (text, record) => {
            return  <Tooltip placement="topLeft" title={record['url']}>
                       {getPathWithoutParams(record['url'])}
                    </Tooltip> 
          }
        },
        {
          title: 'Type',
          dataIndex: 'type',
          key: 'type',
          width: 20,
          filters: [
            {
              text: 'Stylesheet',
              value: 'Stylesheet',
            },
            {
              text: 'Script',
              value: 'Script',
            },
            {
              text: 'XHR',
              value: 'XHR',
            },
            {
              text: 'Document',
              value: 'Document',
            },
            {
              text: 'Fetch',
              value: 'Fetch',
            },
          ],
          onFilter: (value, record) => record['type'] === value,
        },
        {
          title: 'Hit',
          dataIndex: 'hit',
          key: 'hit',
          render: (text, record) => {
            return record['hit']?<ExclamationCircleTwoTone style={{ fontSize: '16px'}}  twoToneColor="#eb2f96" />: <SmileTwoTone style={{ fontSize: '16px'}} twoToneColor="#52c41a" />
          },
          width: 20,
          filters: [
            {
              text: 'Hit',
              value: true,
            },
            {
              text: 'NOT Hit',
              value: false,
            },
          ],
          onFilter: (value, record) => {

            return record['hit'] === value
          },
        },
        {
          title: 'Content',
          dataIndex: 'result',
          key: 'result',
          render: (text, record) => {
            return record['result'].length===0?'':<ReactJson src={record['result']} collapsed={true} />
          }
        },
        {
            title: 'Remark',
            dataIndex: 'remark',
            key: 'remark',
            width: 150,
          }
      ];

    
  function exportExcel() {
      onExportBasicExcel("senstive-word-check-result.xlsx", columns, props.words, props.checkResult)
    }
    return (
        <>
            <Divider>Check Result</Divider>
            <Button type="primary" onClick={exportExcel}>Export Result</Button>
            <Tabs
              defaultActiveKey="1"
              centered
              items={props.words.map((_, i) => {
              const id = String(i + 1);
              return {
                  label: `${props.words[i]}`,
                  key: `${props.words[i]}`,
                  children: <Table
                              columns={columns}
                              dataSource={props.checkResult[props.words[i]]===undefined?[]:props.checkResult[props.words[i]]}
                              // scroll={{
                              // x: 1800,
                              // y: 1500,
                              // }}
                          />,
              };
            })}
            onChange={()=>{}}
      />    

    
        </>
        

    )





};
export default ResultTable;

