import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  normalizeCpf,
  normalizeStatus,
  parseFaturamentoWorkbook,
  toDateISO,
  toNumber,
} from "./faturamento.server";

describe("normalizeCpf", () => {
  it("limpa formatação e completa zeros à esquerda", () => {
    expect(normalizeCpf("830.191.381-91")).toBe("83019138191");
    expect(normalizeCpf(25579648839)).toBe("25579648839");
    expect(normalizeCpf(3329987979)).toBe("03329987979");
    expect(normalizeCpf("")).toBeNull();
    expect(normalizeCpf(null)).toBeNull();
  });
});

describe("toNumber", () => {
  it("aceita número e formato brasileiro", () => {
    expect(toNumber(1740)).toBe(1740);
    expect(toNumber("  1.740,00 ")).toBe(1740);
    expect(toNumber("R$  6.000,00")).toBe(6000);
    expect(toNumber("0,00%")).toBe(0);
    expect(toNumber("")).toBeNull();
  });
});

describe("toDateISO", () => {
  it("aceita Date e dd/mm/yy", () => {
    expect(toDateISO(new Date(2026, 0, 21))).toBe("2026-01-21");
    expect(toDateISO("15/08/23")).toBe("2023-08-15");
    expect(toDateISO("5/3/2024")).toBe("2024-03-05");
    expect(toDateISO(null)).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("normaliza variações da planilha", () => {
    expect(normalizeStatus("OK")).toBe("pago");
    expect(normalizeStatus("Aberto")).toBe("aberto");
    expect(normalizeStatus("cancelado")).toBe("cancelado");
    expect(normalizeStatus("Perda")).toBe("perda");
    expect(normalizeStatus("Novo Contrato")).toBe("novo_contrato");
    expect(normalizeStatus(null)).toBe("aberto");
  });
});

describe("parseFaturamentoWorkbook", () => {
  it("lê clientes e parcelas de um workbook mínimo no formato da planilha", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["CADASTRO DE CLIENTES"],
        ["CPF?", "CPF", "NOME", "E-MAIL", "ENDEREÇO", "CIDADE/UF", "FONE"],
        ["FALSE", "830.191.381-91", "Katiucia Garcia", "k@x.com", "Rua A", "Cuiabá/MT", "65 9999"],
      ]),
      "CLIENTES",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["", "", "", "2.0"],
        ["BASE DE REGISTRO DAS VENDAS"],
        // prettier-ignore
        ["CPF", "NOME CLIENTE", "DT_VENDA", "ID_Curso", "Módulos", "Docente", "Escola", "Valor", "Desconto", "R$_Venda", "ID_plano", "Plano", "Prazo", "Parcelas", "Custo", "Vcto", "R$_Parcela", "R$_Liquido", "DT_RCBTO", "R$_RCBTO", "Status", "Atraso"],
        // prettier-ignore
        ["830.191.381-91", "Katiucia Garcia", "15/08/23", 40000, "Convenção", "Leticia", "", 1740, null, 1740, "2.1", "PIX 1X", 1, 1, null, "15/08/23", 1740, 1740, "15/08/23", 1740, "OK", 0],
      ]),
      "BASE",
    );
    // PLANOS na planilha real comeca na coluna B; o SheetJS corta a coluna vazia
    // e desloca os indices. O parser deve achar o cabecalho em qualquer coluna.
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["PLANOS DE RECEBIMENTO DAS VENDAS"],
        ["ID_plano", "Nome Plano", "Parcelas", "Prazo(dias)", "Taxa(am)"],
        ["2.1", "PIX 1X", 1, 0, null],
        ["6.12", "Cartão 12x", 12, 360, "0.1776"],
      ]),
      "PLANOS",
    );
    const parsed = parseFaturamentoWorkbook(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    expect(parsed.planos).toHaveLength(2);
    expect(parsed.planos[0]).toMatchObject({ id_plano: "2.1", nome: "PIX 1X", parcelas: 1 });
    expect(parsed.clientes).toHaveLength(1);
    expect(parsed.clientes[0].cpf).toBe("83019138191");
    expect(parsed.parcelas).toHaveLength(1);
    expect(parsed.parcelas[0]).toMatchObject({
      cpf: "83019138191",
      dt_venda: "2023-08-15",
      id_curso: "40000",
      valor_liquido: 1740,
      status: "pago",
    });
  });
});
