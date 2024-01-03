import {saveAs} from "file-saver";
import 'regenerator-runtime/runtime';
import * as ExcelJs from 'exceljs';

import {Workbook} from "exceljs";

const DEFAULT_COLUMN_WIDTH = 20;

// 根据 antd 的 column 生成 exceljs 的 column
export function generateHeaders(columns: any[]) {
    console.log("generateHeaders:", columns)
    return columns?.map(col => {
        const obj = {
            // 显示的 name
            header: col.title,
            // 用于数据匹配的 key
            key: col.dataIndex,
            // 列宽
            width: col.width / 5 || DEFAULT_COLUMN_WIDTH,
        };
        return obj;
    })
}

export function saveWorkbook(workbook: Workbook, fileName: string) {
    // 导出文件
    workbook.xlsx.writeBuffer().then((data => {
        const blob = new Blob([data], {type: ''});
        saveAs(blob, fileName);
    }))
}

export function onExportBasicExcel(file_name, columns, sheets, urlResponseDataList) {
    console.log(file_name, urlResponseDataList)
    if(urlResponseDataList.length===0){
        alert("the check data is null")
        return
    }
    console.log("onExportBasicExcel", urlResponseDataList, columns, sheets)
    // 创建工作簿
    const workbook = new ExcelJs.Workbook();
    // 添加sheet
    sheets.forEach((sheet, index) => {
        if(urlResponseDataList[sheet]===undefined || urlResponseDataList[sheet].length===0){

        }else{
            const worksheet = workbook.addWorksheet(sheet);
            // 设置 sheet 的默认行高
            worksheet.properties.defaultRowHeight = 20;
            // 设置列
            worksheet.columns = generateHeaders(columns);
            // 添加行
            worksheet.addRows(urlResponseDataList[sheet]);
            // 这里需要把截图一个一个添加
            urlResponseDataList[sheet].forEach((row, index) => {
                if(row['screenShot'] !== undefined){
                    const imageId = workbook.addImage({
                        base64: row['screenShot'],
                        extension: 'png',
                    });
                    worksheet.addImage(imageId, {
                        tl: { col: 1, row: index+1 },
                        ext: { width: 200, height: 200 }
                    });
                    // 将丹铅的单元格大小也设置成200,200
                    worksheet.getRow(index+1).height = 200;
                }
            }) 
        }

    })

    // 导出excel 'simple-demo.xlsx'
    saveWorkbook(workbook, file_name);
}
