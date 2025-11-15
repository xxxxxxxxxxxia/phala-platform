mod types;
mod dcap;

use std::fs;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};
use serde_json::Value;
use types::SgxV30QuoteCollateral;
use scale::Decode;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 3 {
        eprintln!("用法: {} <quote_file> <collateral_file_or_json>", args[0]);
        std::process::exit(1);
    }

    let quote_path = &args[1];
    let collateral_input = &args[2];

    // 读取 Quote
    let quote_data = match fs::read(quote_path) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("读取 Quote 文件失败: {}", e);
            std::process::exit(1);
        }
    };

    // 解析 Collateral
    let collateral: SgxV30QuoteCollateral = if collateral_input.starts_with('{') {
        // JSON 格式的 Collateral
        let json: Value = serde_json::from_str(collateral_input)
            .expect("解析 JSON 失败");
        
        SgxV30QuoteCollateral {
            pck_crl_issuer_chain: json["pck_crl_issuer_chain"].as_str().unwrap_or("").to_string(),
            root_ca_crl: json["root_ca_crl"].as_str().unwrap_or("").to_string(),
            pck_crl: json["pck_crl"].as_str().unwrap_or("").to_string(),
            tcb_info_issuer_chain: json["tcb_info_issuer_chain"].as_str().unwrap_or("").to_string(),
            tcb_info: json["tcb_info"].as_str().unwrap_or("").to_string(),
            tcb_info_signature: hex::decode(json["tcb_info_signature"].as_str().unwrap_or(""))
                .unwrap_or_default(),
            qe_identity_issuer_chain: json["qe_identity_issuer_chain"].as_str().unwrap_or("").to_string(),
            qe_identity: json["qe_identity"].as_str().unwrap_or("").to_string(),
            qe_identity_signature: hex::decode(json["qe_identity_signature"].as_str().unwrap_or(""))
                .unwrap_or_default(),
        }
    } else {
        // SCALE 编码的二进制文件
        let collateral_data = match fs::read(collateral_input) {
            Ok(data) => data,
            Err(e) => {
                eprintln!("读取 Collateral 文件失败: {}", e);
                std::process::exit(1);
            }
        };
        
        SgxV30QuoteCollateral::decode(&mut collateral_data.as_slice())
            .expect("解码 Collateral 失败")
    };

    // 获取当前时间戳
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("时间错误")
        .as_secs();

    // 调用验证函数
    match dcap::verify(&quote_data, &collateral, now) {
        Ok((report_data, pruntime_hash, tcb_status, advisory_ids)) => {
            // 输出 JSON 格式的结果
            let result = serde_json::json!({
                "success": true,
                "report_data": hex::encode(report_data),
                "pruntime_hash": hex::encode(pruntime_hash),
                "tcb_status": tcb_status,
                "advisory_ids": advisory_ids,
                "timestamp": now
            });
            println!("{}", serde_json::to_string_pretty(&result).unwrap());
        }
        Err(e) => {
            let error_result = serde_json::json!({
                "success": false,
                "error": format!("{:?}", e),
                "timestamp": now
            });
            eprintln!("{}", serde_json::to_string_pretty(&error_result).unwrap());
            std::process::exit(1);
        }
    }
}
