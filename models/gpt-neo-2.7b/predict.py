import torch
from cog import BaseRunner, Input
from transformers import AutoModelForCausalLM, AutoTokenizer


class Runner(BaseRunner):
    def setup(self):
        self.tokenizer = AutoTokenizer.from_pretrained("/weights")
        self.model = AutoModelForCausalLM.from_pretrained(
            "/weights",
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True,
        ).to("cuda").eval()

    @torch.inference_mode()
    def run(
        self,
        prompt: str = Input(description="Text for GPT-Neo to continue"),
        max_new_tokens: int = Input(default=180, ge=1, le=400),
        temperature: float = Input(default=0.8, ge=0.01, le=2.0),
        top_p: float = Input(default=1.0, ge=0.01, le=1.0),
        repetition_penalty: float = Input(default=1.0, ge=0.1, le=2.0),
    ) -> str:
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048 - max_new_tokens,
        ).to("cuda")
        output = self.model.generate(
            **inputs,
            do_sample=True,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            pad_token_id=self.tokenizer.eos_token_id,
        )
        return self.tokenizer.decode(
            output[0, inputs.input_ids.shape[1]:],
            skip_special_tokens=True,
        )
