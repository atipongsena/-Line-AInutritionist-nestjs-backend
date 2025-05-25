import React, { useState, useEffect } from 'react'
import {
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextField,
  Box,
} from '@mui/material'

interface Option {
  value: string
  label: string
}

interface MultipleCheckboxWithOtherProps {
  formControlLabel: string // Main label for the FormControl
  name: string // Name attribute for the form field, used in formData
  options: Option[] // Array of predefined checkbox options
  currentSelectedValues: string[] // Current selected values from parent state (formData)
  onValuesChange: (fieldName: string, newValues: string[]) => void // Callback to update parent state
}

const MultipleCheckboxWithOther: React.FC<MultipleCheckboxWithOtherProps> = ({
  formControlLabel,
  name,
  options,
  currentSelectedValues,
  onValuesChange,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [isOtherChecked, setIsOtherChecked] = useState(false)

  useEffect(() => {
    const predefinedValues = options.map((opt) => opt.value)
    const currentPredefinedSelected = currentSelectedValues.filter((val) =>
      predefinedValues.includes(val),
    )
    setSelectedOptions(currentPredefinedSelected)

    const otherValueFromProps = currentSelectedValues.find(
      (val) => !predefinedValues.includes(val),
    )

    if (otherValueFromProps !== undefined) {
      setOtherText(otherValueFromProps)
      if (!isOtherChecked) {
        setIsOtherChecked(true)
      }
    } else {
      setOtherText('')
    }
  }, [currentSelectedValues, options, isOtherChecked])

  const handleOptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.target
    let newSelectedOptions = [...selectedOptions]
    if (checked) {
      newSelectedOptions.push(value)
    } else {
      newSelectedOptions = newSelectedOptions.filter((opt) => opt !== value)
    }
    setSelectedOptions(newSelectedOptions)
    triggerOnChange(newSelectedOptions, isOtherChecked, otherText)
  }

  const handleOtherCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { checked } = event.target
    setIsOtherChecked(checked)
    if (!checked) {
      setOtherText('')
      triggerOnChange(selectedOptions, false, '')
    } else {
      triggerOnChange(selectedOptions, true, otherText)
    }
  }

  const handleOtherTextChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newOtherText = event.target.value
    setOtherText(newOtherText)
    if (isOtherChecked) {
      triggerOnChange(selectedOptions, true, newOtherText)
    }
  }

  const triggerOnChange = (
    currentOpts: string[],
    currentIsOtherChecked: boolean,
    currentOtherVal: string,
  ) => {
    let finalValues = [...currentOpts]
    if (currentIsOtherChecked && currentOtherVal.trim() !== '') {
      finalValues.push(currentOtherVal.trim())
    }
    finalValues = Array.from(new Set(finalValues))
    onValuesChange(name, finalValues)
  }

  return (
    <FormControl component="fieldset" margin="normal" fullWidth>
      <FormLabel component="legend">{formControlLabel}</FormLabel>
      <FormGroup>
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedOptions.includes(option.value)}
                onChange={handleOptionChange}
                value={option.value}
              />
            }
            label={option.label}
          />
        ))}
        <FormControlLabel
          control={
            <Checkbox
              checked={isOtherChecked}
              onChange={handleOtherCheckboxChange}
            />
          }
          label="อื่นๆ (โปรดระบุ)"
        />
        {isOtherChecked && (
          <Box sx={{ pl: 4, pt: 1 }}>
            {' '}
            {/* Indent TextField slightly */}
            <TextField
              fullWidth
              variant="standard"
              placeholder="ระบุอื่นๆ"
              value={otherText}
              onChange={handleOtherTextChange}
              size="small"
            />
          </Box>
        )}
      </FormGroup>
    </FormControl>
  )
}

export default MultipleCheckboxWithOther
