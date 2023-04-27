module.exports = {
    "libx265": {
        "name": "libx265",
        "type": "CPU",
        "quality": "crf",
        "quality_constract": ["-crf"],
        "quality_preset_command": "-preset",
        "quality_preset_constract": ["fast", "medium", "slow"]
        
    },
    "hevc_nvenc": {
        "name": "hevc_nvenc",
        "type": "GPU",
        "quality": "vbr",
        "quality_command": "-rc 1",
        "quality_constract": ["-qp"],
        "quality_preset_command": "-preset",
        "quality_preset_constract": ["fast", "medium", "slow"]
    },
    "hevc_amf": {
        "name": "hevc_amf",
        "type": "GPU",
        "quality": "cqp",
        "quality_command": "-rc 0",
        "quality_constract": ["-qp_p", "-qp_i"],
        "quality_preset_command": "-quality",
        "quality_preset_constract": ["speed", "balanced", "quality"]
    },
}